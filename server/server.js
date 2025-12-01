import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Dropbox 설정
// Netlify는 점(.)을 허용하지 않으므로 언더스코어(_) 사용
const DROPBOX_ACCESS_TOKEN = process.env['dropbox_access_token'] || process.env['dropbox.access.token'];

app.use(cors());
app.use(express.json());

// model.json 파일 가져오기
app.post('/api/dropbox/folder-contents', async (req, res) => {
    try {
        const { folderId, fileId, rlkey, st } = req.body;
        const modelJsonUrl = `https://dl.dropboxusercontent.com/scl/fo/${folderId}/${fileId}/model.json?rlkey=${rlkey}&st=${st}&raw=1`;

        const response = await axios.get(modelJsonUrl, {
            headers: {
                'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
                'Accept': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching folder contents:', error);
        res.status(500).json({
            message: error.response?.data?.message || '파일을 가져오는데 실패했습니다.'
        });
    }
});

// 개별 파일 다운로드
app.get('/api/dropbox/file', async (req, res) => {
    try {
        const { folderId, fileId, fileName, rlkey, st } = req.query;
        const fileUrl = `https://dl.dropboxusercontent.com/scl/fo/${folderId}/${fileId}/${fileName}?rlkey=${rlkey}&st=${st}&raw=1`;

        const response = await axios.get(fileUrl, {
            responseType: 'stream',
            headers: {
                'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`
            }
        });

        res.setHeader('Content-Type', response.headers['content-type']);
        response.data.pipe(res);
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({
            message: error.response?.data?.message || '파일 다운로드에 실패했습니다.'
        });
    }
});

// 토큰 유효성 검사 엔드포인트 추가
app.get('/api/dropbox/validate-token', async (req, res) => {
    try {
        const response = await axios.post('https://api.dropboxapi.com/2/check/user', {}, {
            headers: {
                'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        res.json({ valid: true });
    } catch (error) {
        console.error('Token validation error:', error);
        res.status(401).json({ valid: false, message: '토큰이 유효하지 않습니다.' });
    }
});

// 카메라 상태 JSON 파일을 드롭박스에 업로드
app.post('/api/dropbox/upload-camera-states', async (req, res) => {
    try {
        if (!DROPBOX_ACCESS_TOKEN) {
            return res.status(500).json({
                message: 'Dropbox 액세스 토큰이 설정되지 않았습니다.'
            });
        }

        const { folderId, filename, data } = req.body;

        if (!folderId || !filename || !data) {
            return res.status(400).json({
                message: 'folderId, filename, data가 필요합니다.'
            });
        }

        // 공유 폴더의 경로 찾기
        // 공유 링크를 통해 폴더 정보 가져오기
        let folderPath = null;
        
        // scl/fo 형식 시도
        try {
            const shareLinkResponse = await axios.post(
                'https://api.dropboxapi.com/2/sharing/get_shared_link_metadata',
                {
                    url: `https://www.dropbox.com/scl/fo/${folderId}/?dl=0`
                },
                {
                    headers: {
                        'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (shareLinkResponse.data && shareLinkResponse.data.path_lower) {
                folderPath = shareLinkResponse.data.path_lower;
                console.log(`공유 폴더 경로 찾음 (fo): ${folderPath}`);
            }
        } catch (shareError) {
            console.warn('공유 링크 메타데이터 가져오기 실패 (fo):', shareError.response?.data || shareError.message);
        }
        
        // scl/fi 형식도 시도 (fo가 실패한 경우)
        if (!folderPath) {
            try {
                const shareLinkResponseFi = await axios.post(
                    'https://api.dropboxapi.com/2/sharing/get_shared_link_metadata',
                    {
                        url: `https://www.dropbox.com/scl/fi/${folderId}/?dl=0`
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                if (shareLinkResponseFi.data && shareLinkResponseFi.data.path_lower) {
                    folderPath = shareLinkResponseFi.data.path_lower;
                    console.log(`공유 폴더 경로 찾음 (fi): ${folderPath}`);
                }
            } catch (shareErrorFi) {
                console.warn('공유 링크 메타데이터 가져오기 실패 (fi):', shareErrorFi.response?.data || shareErrorFi.message);
            }
        }

        // 경로를 찾지 못한 경우, 공유 폴더 ID로 직접 업로드 시도
        // 공유 폴더에 파일을 업로드하려면 sharing/get_shared_link_file API 사용
        let uploadPath = null;
        
        if (folderPath) {
            // 폴더 경로를 찾은 경우, 해당 폴더에 파일 업로드
            uploadPath = `${folderPath}/${filename}`;
            
            const uploadResponse = await axios.post(
                'https://content.dropboxapi.com/2/files/upload',
                data,
                {
                    headers: {
                        'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
                        'Content-Type': 'application/octet-stream',
                        'Dropbox-API-Arg': JSON.stringify({
                            path: uploadPath,
                            mode: 'add',
                            autorename: true,
                            mute: false
                        })
                    }
                }
            );
            
            console.log(`✅ 카메라 상태 파일 업로드 성공: ${uploadPath}`);
            
            res.json({
                success: true,
                path: uploadPath,
                message: '카메라 상태 파일이 드롭박스 폴더에 업로드되었습니다.'
            });
        } else {
            // 경로를 찾지 못한 경우 에러 반환
            return res.status(400).json({
                message: '공유 폴더 경로를 찾을 수 없습니다. 드롭박스 공유 링크가 유효한지 확인해주세요.'
            });
        }

    } catch (error) {
        console.error('❌ 카메라 상태 파일 업로드 실패:', error.response?.data || error.message);
        res.status(500).json({
            message: error.response?.data?.error_summary || '파일 업로드에 실패했습니다.',
            error: error.message
        });
    }
});

// 정적 파일 서빙 (Vite 빌드 파일)
app.use(express.static(join(__dirname, '../dist')));

app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
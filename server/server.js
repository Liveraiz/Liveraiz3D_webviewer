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
const DROPBOX_ACCESS_TOKEN = process.env['dropbox.access.token'];

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

// 정적 파일 서빙 (Vite 빌드 파일)
app.use(express.static(join(__dirname, '../dist')));

app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
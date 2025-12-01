const axios = require('axios');

exports.handler = async function(event, context) {
    // CORS 헤더 설정
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // OPTIONS 요청 처리 (CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // POST 요청만 처리
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ message: 'Method not allowed' })
        };
    }

    try {
        // Dropbox 액세스 토큰 확인
        // Netlify는 점(.)을 허용하지 않으므로 언더스코어(_) 사용
        const DROPBOX_ACCESS_TOKEN = process.env['dropbox_access_token'] || process.env['dropbox.access.token'];
        
        if (!DROPBOX_ACCESS_TOKEN) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    message: 'Dropbox 액세스 토큰이 설정되지 않았습니다.'
                })
            };
        }

        // 요청 본문 파싱
        const { folderId, filename, data } = JSON.parse(event.body);

        if (!folderId || !filename || !data) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'folderId, filename, data가 필요합니다.'
                })
            };
        }

        // 공유 폴더의 경로 찾기
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

        // 경로를 찾지 못한 경우 에러 반환
        if (!folderPath) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: '공유 폴더 경로를 찾을 수 없습니다. 드롭박스 공유 링크가 유효한지 확인해주세요.'
                })
            };
        }

        // 해당 폴더에 파일 업로드
        const uploadPath = `${folderPath}/${filename}`;
        
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
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                path: uploadPath,
                message: '카메라 상태 파일이 드롭박스 폴더에 업로드되었습니다.'
            })
        };

    } catch (error) {
        console.error('❌ 카메라 상태 파일 업로드 실패:', error.response?.data || error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                message: error.response?.data?.error_summary || '파일 업로드에 실패했습니다.',
                error: error.message
            })
        };
    }
};


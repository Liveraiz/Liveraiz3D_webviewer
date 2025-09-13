const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    const { url } = event.queryStringParameters || {};
    
    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'URL parameter is required' })
      };
    }
    
    // TinyURL API 사용
    try {
      const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const shortUrl = await response.text();
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            shortUrl,
            originalUrl: url,
            success: true
          })
        };
      }
    } catch (error) {
      console.error('TinyURL API 실패:', error);
    }
    
    // TinyURL 실패시 is.gd API 사용
    try {
      const response = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.shorturl) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              shortUrl: data.shorturl,
              originalUrl: url,
              success: true
            })
          };
        }
      }
    } catch (error) {
      console.error('is.gd API 실패:', error);
    }
    
    // 모든 API 실패시 원본 URL 반환
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        shortUrl: url,
        originalUrl: url,
        success: false,
        message: 'URL 단축에 실패했습니다. 원본 URL을 사용합니다.'
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 
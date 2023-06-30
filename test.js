import { ChatGPTAPI } from 'chatgpt';

const api = new ChatGPTAPI({
    debug: true,
    apiKey: process.env.OPENAI_API_KEY,
    apiReverseProxyUrl: process.env.apiReverseProxyUrl || 'http://127.0.0.1:8000/v1/chat/completions',
    apiBaseUrl: process.env.apiBaseUrl || 'http://127.0.0.1:8000/v1',
});
console.log(1)
const response = await api.sendMessage('hi 写500字介绍自己')

console.log(response.text)
console.log(2)
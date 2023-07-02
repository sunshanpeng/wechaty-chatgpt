
// Bypass restricted countries, such as China.
function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// https://github.com/acheong08/EdgeGPT/blob/master/src/EdgeGPT.py#L38
const randomIP = `13.${random(104, 107)}.${random(0, 255)}.${random(0, 255)}`


// 定义一个全局的拦截器对象
const globalFetchInterceptor = {
    // 拦截请求
    requestInterceptor: (url, options) => {
        if (url.indexOf('bing.com') != -1 && options && options.headers) {
            options.headers = {
                ...options.headers,
                'x-forwarded-for': randomIP,
            };
        }

        return [url, options];
    }
};

// 保存原始的 fetch 方法
const originalFetch = global.fetch;

// 重写 fetch 方法
global.fetch = function (url, options) {
    // 调用请求拦截器
    const [newUrl, newOptions] = globalFetchInterceptor.requestInterceptor(url, options);

    // 发送请求
    const promise = originalFetch(newUrl, newOptions);

    // 处理响应
    promise.then((response) => {
        return response;
    });

    return promise;
};

const SYDNEY_ORIGIN = 'https://sydney.bing.com';
const KEEP_REQ_HEADERS = [
    'accept',
    'accept-encoding',
    'accept-language',
    'connection',
    'cookie',
    'upgrade',
    'user-agent',
    'sec-websocket-extensions',
    'sec-websocket-key',
    'sec-websocket-version',
    'x-request-id',
    'content-length',
    'content-type',
    'access-control-request-headers',
    'access-control-request-method',
];
const IP_RANGE = [
    ['3.2.50.0', '3.5.31.255'], //192,000
    ['3.12.0.0', '3.23.255.255'], //786,432
    ['3.30.0.0', '3.33.34.255'], //205,568
    ['3.40.0.0', '3.63.255.255'], //1,572,864
    ['3.80.0.0', '3.95.255.255'], //1,048,576
    ['3.100.0.0', '3.103.255.255'], //262,144
    ['3.116.0.0', '3.119.255.255'], //262,144
    ['3.128.0.0', '3.247.255.255'], //7,864,320
];

/**
 * 随机整数 [min,max)
 * @param {number} min
 * @param {number} max
 * @returns
 */
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min)) + min;

/**
 * ip 转 int
 * @param {string} ip
 * @returns
 */
const ipToInt = (ip) => {
    const ipArr = ip.split('.');
    let result = 0;
    result += +ipArr[0] << 24;
    result += +ipArr[1] << 16;
    result += +ipArr[2] << 8;
    result += +ipArr[3];
    return result;
};

/**
 * int 转 ip
 * @param {number} intIP
 * @returns
 */
const intToIp = (intIP) => {
    return `${(intIP >> 24) & 255}.${(intIP >> 16) & 255}.${(intIP >> 8) & 255}.${intIP & 255}`;
};

const getRandomIP = () => {
    const randIndex = getRandomInt(0, IP_RANGE.length);
    const startIp = IP_RANGE[randIndex][0];
    const endIp = IP_RANGE[randIndex][1];
    const startIPInt = ipToInt(startIp);
    const endIPInt = ipToInt(endIp);
    const randomInt = getRandomInt(startIPInt, endIPInt);
    const randomIP = intToIp(randomInt);
    return randomIP;
};

/**
 * home
 * @param {string} pathname
 * @returns
 */
const home = async (pathname) => {
    const baseUrl = 'https://raw.githubusercontent.com/adams549659584/go-proxy-bingai/master/';
    let url;
    // if (pathname.startsWith('/github/')) {
    if (pathname.indexOf('/github/') === 0) {
        url = pathname.replace('/github/', baseUrl);
    } else {
        url = baseUrl + 'cloudflare/index.html';
    }
    const res = await fetch(url);
    const newRes = new Response(res.body, res);
    if (pathname === '/') {
        newRes.headers.delete('content-security-policy');
        newRes.headers.set('content-type', 'text/html; charset=utf-8');
    }
    return newRes;
};

export default {
    /**
     * fetch
     * @param {Request} request
     * @param {*} env
     * @param {*} ctx
     * @returns
     */
    async fetch(request, env, ctx) {
        const currentUrl = new URL(request.url);
        // if (currentUrl.pathname === '/' || currentUrl.pathname.startsWith('/github/')) {
        if (currentUrl.pathname === '/' || currentUrl.pathname.indexOf('/github/') === 0) {
            return home(currentUrl.pathname);
        }
        const targetUrl = new URL(SYDNEY_ORIGIN + currentUrl.pathname + currentUrl.search);

        if (currentUrl.pathname === '/turing/conversation/create') {
            targetUrl.host = 'bing.com'
        }

        if (currentUrl.pathname === '/images/create') { //AI画图
            return goUrl(request, "https://www.bing.com/images/create" + currentUrl.search, {
                "referer": "https://www.bing.com/search?q=bingAI"
            }, 'manual');
        }
        if (currentUrl.pathname.startsWith('/images/create/async/results')) { //请求AI画图图片
            currentUrl.hostname = "www.bing.com";
            return goUrl(request, currentUrl.toString(), {
                "referer": "https://www.bing.com/images/create?partner=sydney&showselective=1&sude=1&kseed=7000"
            });

        }
        if (currentUrl.pathname.startsWith('/rp')) { //显示AI画图错误提示图片
            currentUrl.hostname = "www.bing.com";
            return goUrl(request, currentUrl.toString(), {
                "referer": "https://www.bing.com/search?q=bingAI"
            });
        }


        const newHeaders = new Headers();
        request.headers.forEach((value, key) => {
            // console.log(`old : ${key} : ${value}`);
            if (KEEP_REQ_HEADERS.includes(key)) {
                newHeaders.set(key, value);
            }
        });
        newHeaders.set('host', targetUrl.host);
        newHeaders.set('origin', targetUrl.origin);
        newHeaders.set('referer', 'https://www.bing.com/search?q=Bing+AI');
        const randIP = getRandomIP();
        // console.log('randIP : ', randIP);
        newHeaders.set('X-Forwarded-For', randIP);
        const oldUA = request.headers.get('user-agent');
        const isMobile = oldUA.includes('Mobile') || oldUA.includes('Android');
        if (isMobile) {
            newHeaders.set(
                'user-agent',
                'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.7 Mobile/15E148 Safari/605.1.15 BingSapphire/1.0.410427012'
            );
        } else {
            newHeaders.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.35');
        }

        // newHeaders.forEach((value, key) => console.log(`${key} : ${value}`));
        const newReq = new Request(targetUrl, {
            method: request.method,
            headers: newHeaders,
            body: request.body,
        });

        const res = await fetch(newReq);
        return res;
    },
};


//请求某地址
async function goUrl(request, url, addHeaders, redirect = 'follow') {
    //构建 fetch 参数
    let fp = {
        method: request.method,
        headers: {},
        redirect: redirect,
    }
    //保留头部信息
    let reqHeaders = request.headers;
    let dropHeaders = ["accept", "accept-language", "accept-encoding"];
    for (let h of dropHeaders) {
        if (reqHeaders.has(h)) {
            fp.headers[h] = reqHeaders.get(h);
        }
    }

    fp.headers["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.57"
    const randomIp = () => Array(4).fill(0).map((_, i) => Math.floor(Math.random() * 255) + (i === 0 ? 1 : 0)).join('.');
    //添加X-forwarded-for
    fp.headers['x-forwarded-for'] = randomIp();

    if (addHeaders) {
        //添加头部信息
        for (let h in addHeaders) {
            fp.headers[h] = addHeaders[h];
        }
    }

    fp.headers["cookie"] = reqHeaders.get('cookie');
    let res = await fetch(url, fp);

    console.log(`bing status =>:${res.status}`)
    res.headers.forEach((value, key) => console.log(`${key} : ${value}`));

    let newRes = new Response(res.body, res);

    if (res.status == 302) {
        return new Response(null, {
            status: 302,
            statusText: 'redirect',
            headers: res.headers
        })
    }
    return newRes;
}

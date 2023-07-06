
import { FileBox } from 'file-box'
import * as Base64 from 'js-base64'

async function getMermaidCode(ai, nl) {
    const prompt = `你是一名助手，帮助用户用 Mermaid 构建图表。
    您只需要返回输出的 Mermaid 代码块。
    不要输出任何描述，不使用 markdown
    Question:  ${nl}
    Helpful Answer:
    `
    const { text } = await ai.sendMessage(prompt)

    return text
}


function renderMermaidSVG(mermaidCode) {
    const matchData = mermaidCode.match(/```mermaid([^\n]*\n?)*```/gm);
    if (matchData) {
        mermaidCode = matchData[0].replace("```mermaid", "").replace("```", "")
    }
    mermaidCode = mermaidCode.replace("```", "")
    const jsonString = Base64.encodeURI(JSON.stringify({
        code: mermaidCode,
        mermaid: {
            theme: "default",
        },
    }));
    const url = `https://mermaid.ink/img/${jsonString}`
    console.log(mermaidCode, url)
    return FileBox.fromUrl(url, { name: `${new Date().getTime()}.png` });
}


function mdToSVG(data) {
    // const matchData = data.match(/```mermaid(.|\n)*?```/gm);
    const matchData = data.match(/```mermaid([^\n]*\n?)*```/gm);

    // const matchData = [data];
    console.log(data)
    const jsonStrings = matchData
        .map((item) => item.replace("```mermaid", "").replace("```", ""))
        // Workaround for classdiagram
        .map((item) =>
            item.startsWith("\nclass") ||
                item.startsWith("\ngantt") ||
                item.startsWith("\nerDiagram") ||
                item.startsWith("\njourney")
                ? item.substr(1, item.length - 1)
                : item
        )
        .map((item) =>
            JSON.stringify({
                code: item,
                mermaid: {
                    theme: "default",
                },
            })
        )
        .map((item) => {
            const jsonString = Base64.encodeURI(item);
            return `[![](https://mermaid.ink/img/${jsonString})](https://mermaid-js.github.io/mermaid-live-editor/#/edit/${jsonString})`;
        });

    let changeMd = data;
    matchData.forEach((item, index) => {
        changeMd = changeMd.replace(item, jsonStrings[index]);
    });

    return changeMd;
}


export { getMermaidCode, renderMermaidSVG }


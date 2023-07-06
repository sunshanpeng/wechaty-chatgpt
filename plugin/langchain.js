import { PineconeClient } from "@pinecone-database/pinecone";
import dotenv from 'dotenv';
import { VectorDBQAChain } from "langchain/chains";
import { DirectoryLoader } from "langchain/document_loaders";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PromptLayerOpenAI } from "langchain/llms/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "langchain/vectorstores";

dotenv.config();
const client = new PineconeClient();

await client.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
});

const pineconeIndex = client.Index(process.env.PINECONE_INDEX);


async function loadDocuments(directory = 'resource') {
    console.log('loadDocuments...')
    const loader = new DirectoryLoader(directory,
        {
            ".pdf": (path) => new PDFLoader(path),
            ".txt": (path) => new TextLoader(path),
            ".doc": (path) => new DocxLoader(path),
            ".docx": (path) => new DocxLoader(path),
        });
    // 将数据转成 document 对象，每个文件会作为一个 document
    const rawDocuments = await loader.load();
    console.log(`documents: ${rawDocuments.length}`);

    // 初始化加载器
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 500 });
    // 切割加载的 document
    const splitDocs = await textSplitter.splitDocuments(rawDocuments);

    // 持久化数据
    // const docsearch = await Chroma.fromDocuments(splitDocs, embeddings, { collectionName: "private_doc" });
    // docsearch.persist();


    await PineconeStore.fromDocuments(splitDocs, new OpenAIEmbeddings(), {
        pineconeIndex,
    });
    console.log(`send to PineconeStore`);

}


async function askDocument(question) {
    const llm = new PromptLayerOpenAI({ plTags: ["langchain-requests", "chatbot"] })
    // 初始化 openai 的 embeddings 对象

    // 加载数据
    const vectorStore = await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings(),
        { pineconeIndex }
    );

    /* Search the vector DB independently with meta filters */
    const chain = VectorDBQAChain.fromLLM(llm, vectorStore, {
        k: 1,
        returnSourceDocuments: true,
    });
    const response = await chain.call({ query: question });
    console.log(response);

    // const response = await vectorStore.similaritySearch(question, 1);
    // console.log(response);

    return response.text
}

function supportFileType(mediaType) {
    const types = ['doc', 'docx', , 'pdf', 'text']
    return types.filter(e => mediaType.includes(e)).length > 0
}


export { askDocument, loadDocuments, supportFileType };


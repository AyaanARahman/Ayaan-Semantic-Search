import { NextResponse } from "next/server";
import { PineconeClient, utils } from "@pinecone-database/pinecone";
import { TextLoader } from "langchain/document_loaders/fs/text"; //how you load values and data to interact with langchain api
import { PDFLoader } from "langchain/document_loaders/fs/pdf"; //allows you to upload pdfs
import { DirectoryLoader } from "langchain/document_loaders/fs/directory"; //allows to work with directories
//imports from utils
import {
    createPineconeIndex,
    updatePinecone
} from "@/utils";

import { indexName } from "@/config";
import path from "path";

//what we use to interact with pinecone functions
export async function POST (){
    //creating the new instance of DirectoryLoader allows me to pass different paths that I want to work with. 
    //Since I'm passing in documents, 
    const loader = new DirectoryLoader('./documents', {
        ".txt": (path) => new TextLoader(path),
        ".md": (path) => new TextLoader(path),
        ".pdf": (path) => new PDFLoader(path)
    })

    const docs = await loader.load()
    const vectorDimension = 1536

    //create new instance of pinecone client
    const client = new PineconeClient();
    await client.init({
        apiKey: process.env.PINECONE_API_KEY || '',
        environment: process.env.PINECONE_ENVIORNMENT || ''
    })

    

    //try catch block
    //first creates the pinecone index, then upload documents to the index
    //otherwise, catches the error
    try {
        await createPineconeIndex(client, indexName, vectorDimension)
        await updatePinecone(client, indexName, docs)
    } catch(err){
        console.log('error: ', err)
    }

    //create NextResponse
    return NextResponse.json({
        data: 'successfully created index and put data into pinecone...'
    })

    

}

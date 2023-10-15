import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAI } from 'langchain/llms/openai'
import { loadQAChain } from "langchain/chains";
import { Document } from "langchain/document";
import { timeout } from "./config";




export const createPineconeIndex = async (
    client,
    indexName,
    vectorDimension
) => {
    //1. Initiate index existence check
    console.log(`Checking "${indexName}"...`);
    //2. Get list of existing indexes
    const existingIndexes = await client.listIndexes();
    //3. If the index doesn't exist, create it
    if (!existingIndexes.includes(indexName)){
        //4. Log index creation initiation
        console.log(`Creating "${indexName}"...`);
        //5. Create index
        await client.createIndex({
            createRequest: {
                name: indexName,
                dimension: vectorDimension,
                metric: 'cosine',
            },
        });
            //6. Log successful creation
            console.log(`creating index... please wait for it to finish intializing.`);
            //wait for initializtion
            await new Promise((resolve) => setTimeout(resolve, timeout));

    } else {
        //8. Index already exists
        console.log(`"${indexName}" already exists.`)
    
    }

}

export const updatePinecone = async (client, indexName, docs) => {
    //1. get the pinecone index
    const index = client.Index(indexName);
    //2. Log the index name that I got
    console.log(`Pinecone index retrieved: ${indexName}`);
    //3. Process each doc in the doc array
    for (const doc of docs){
        console.log(`Processing doc: ${doc.metadata.source}`);
        const txtPath = doc.metadata.source;
        const text = doc.pageContent;
        //4. Create RecursiveCharacterTextSplitter instance
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
        });
        console.log('Splitting text into chunks...');
        //4.Split text into chunks (documents)
        const chunks = await textSplitter.createDocuments([text]);
        console.log(`Text Split into ${chunks.length} chunks`);
        console.log(
            `Calling OpenAi's Embedding endpoint documents with ${chunks.length} text chunks...`
        );
        //6. Actual API call. Create OpenAI embeddings for documents
        const embeddingsArrays = await new OpenAIEmbeddings().embedDocuments(
            //finds any instance of a new line and replaces it with a space
        chunks.map((chunk) => chunk.pageContent.replace(/\n/g, " "))
        );
        console.log(`Creating ${chunks.length} vectors array with id, values, and metadata...`);

        //7. Create and upsert vectors in batches of 100. Create an array to populate in the loop
        const batchSize = 100;
        let batch:any = [];
        for (let idx = 0; idx < chunks.length; idx++){
            const chunk = chunks[idx];
            const vector = {
                id: `${txtPath}_${idx}`, 
                values: embeddingsArrays[idx], //sets values in embedding array
                metadata: { //passes in additional metadata
                    ...chunk.metadata,
                    loc: JSON.stringify(chunk.metadata.loc),
                    pageContent: chunk.pageContent,
                    txtPath: txtPath,
                },
            };
            //We have the batch array and we're adding the vector to all the existing stuff
            batch = [...batch, vector]

            //When batch is full or last item, upsert vectors
            if (batch.length === batchSize || idx === chunks.length - 1) {
                await index.upsert({
                    upsertRequest: {
                        vectors: batch,
                    },
                });
                //empty the batch
                batch = []
            }
        }

    }
}

export const queryPineconeVectorStoreAndQueryLLM = async (
    client,
    indexName,
    question
) =>{
    //1. start query process
    console.log('Querying Pinecone vector store...');
    //2. Retrieve the pinecone index
    const index = client.Index(indexName);
    //3. Create query embedding
    const queryEmbedding = await new OpenAIEmbeddings().embedQuery(question)
    //4. Query pinecone index and return top 10 matches. Call index.query to talk to pinecone
    let queryResponse = await index.query({
        queryRequest: {
            topK: 10,
            vector: queryEmbedding,
            includeMetadata: true,
            includeValues: true,
        },
    });
    //5. log number of matches
    console.log(`Found ${queryResponse.matches.length} matches...`);
    //6. log question asked
    console.log(`Asking question: ${question}...`);
    //if that came back with anything (found some matches)
    if (queryResponse.matches.length) {
        //7. Create OpenAI instance and load the QAStuffChain
        const llm = new OpenAI({});
        const chain = loadQAChain(llm);
        //8. Extract and concatenate page content from matched documents
        const concatenatedPageContent = queryResponse.matches
            .map((match) => match.metadata.pageContent)
            .join(" ");
        const result = await chain.call({
            input_documents: [new Document({ pageContent: concatenatedPageContent })],
            question: question,
        });
        //9. Log out and return that text
        console.log(`Answer: ${result.text}`);
        return result.text
    } else {
        //11. Log that there aren't matches so gpt wont be queried
        console.log('There are no matches so GPT will not be queried');
    }

}
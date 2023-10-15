//'use client' is needed because I'm using useState
'use client'
import { useState } from "react"
import { POST } from "./api/setup/route"

export default function Home() {
  const [query, setQuery] = useState('') //lets user type in question
  const [result, setResult] = useState('') // is the result coming back from API call to query the database
  const [loading, setLoading] = useState(false) //just shows whether I'm loading into the API


  //For the setup... call the /api/setup function
  async function createIndexAndEmbeddings() {
    try {
      const result = await fetch('/api/setup', {
        method: "POST"
      })
      //wait for the json response, then log it out
      const json = await result.json()
      console.log('result: ', json)
    } catch (err){
      console.log('error: ', err)
    }
  }

  //function used to actually query Pinecone
  async function sendQuery(){
    //first check if the query exists, if it doesn't just return
    if (!query) return
    setResult('')
    setLoading(true)
    try {
      const result = await fetch('/api/read', { //call API and pass in query as the body
        method: "POST",
        body: JSON.stringify(query)
      })
      const json = await result.json()
      console.log('result: ', json)
    } catch (err) {
      console.log('error: ', err)
      setLoading(false)
    }
  }


  return (
    <main className="flex flex-col items-center justify-between p-24">
      <input 
        className='text-black px-2 py-1'
        //e.target.value or event is pretty much whatever is in the input
        onChange={e => setQuery(e.target.value)}
      />
      <button className="px-7 py-1 rounded-2xl bg-white text-black mt-2 mb-2" onClick={sendQuery}>
        Ask me something
      </button>
      {
        loading && <p>Asking AI...</p>
      }
      {
        result && <p>{result}</p>
      }
      <button onClick={createIndexAndEmbeddings}>Create index and embeddings</button>
    </main>
  )
}

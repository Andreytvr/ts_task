import 'dotenv/config'
import dgram from 'dgram';
import http from 'http'
import * as urlModule from 'url'
import {HEARTBEAT_DATA, HELLO_DATA, FULL_CLIENT_DATA, CLIENT_DATA, RETURN_CALL_FUNCTION} from './types/clientTypes'
import {RESULT_ERROR, RESULT_OK, REQUEST_ERROR} from './types/commonTypes'

const PORT = Number(process.env.PORT)

const regexClientId = /^\/clients\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const regexCallFunction = /\/clients\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\/\w+/i

const server = dgram.createSocket('udp4');
const HELLO_MSG = Buffer.from('HELLO_OK')
const HEARTBEAT_MSG = Buffer.from('HEARTBEAT_OK')
const errorObj:RESULT_ERROR = {data:{
  description:'Uncnown request'
}}
const ok_obj:RESULT_OK = {
  data:{
    descrption:'ok'
  }
}


const fullClientsDetails: FULL_CLIENT_DATA[] = []

const regRoute: [RegExp,Function][] = [
  [/^\/clients$/i,apiGetClients],
  [/^\/clients\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i,apiGetClientById],
  [/\/clients\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\/\w+/i,apiGetClientFunction]
]


function getCurrentTime(){
  const date = new Date()
  return date.toISOString()
}

function isHelloData(obj:any): obj is HELLO_DATA{
  try {
    return typeof obj === 'object' &&
  Array.isArray(obj.data.capacities) &&
  typeof obj.data.id === 'string'
  }
  catch {
    return false
  } 
  
}

function isHeartbeat(obj:HEARTBEAT_DATA){
  try{
    return obj.type === 'HEARTBEAT'
  }catch{
    return false
  }
}

function isReturnCullFunctionMsg(obj:RETURN_CALL_FUNCTION ){
  try{
    return obj.type === 'RETURN_CALL_FUNCTION'
  }catch{
    return false
  }
}


function isRequestError(obj: any): obj is REQUEST_ERROR{
  try{
    return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.data === 'object' &&
    (typeof obj.data.description === 'string' || obj.data.description === undefined)
)}catch{
  return false
}
}

function getClientByID(arr:CLIENT_DATA[],clientId:string){
  return arr.find(obj => obj.id === clientId)
  
}

function getFullClientByID(arr:FULL_CLIENT_DATA[],clientId:string){
  return arr.find(obj => obj.id === clientId)
  
}

function getClientIndexById(arr:FULL_CLIENT_DATA[], clientId:string){
  return arr.findIndex(el=>el.id === clientId)
}

function checkClientAvaliable(){
  const currentTime = new Date().getTime()
  fullClientsDetails.forEach(obj=>{
    const timeLastHeartbeat = new Date(obj.timeLastHeartbeat).getTime()
    const timeDifference = currentTime - timeLastHeartbeat

    if(timeDifference >=15000){
      obj.isAvaliable = false
    }
  })
}

function apiGetClients(response:http.ServerResponse, url:string){
      const arrAvaliableClients = fullClientsDetails.filter(obj=>obj.isAvaliable === true)
      response.writeHead(200, {'Content-Type':'text/plain'})
      response.end(JSON.stringify(arrAvaliableClients))

}

function apiGetClientById(response:http.ServerResponse, url:string){
  const clientDetails = getClientsDetails()
  const client = getClientByID(clientDetails,url.substring(9))
  if (client){
    response.writeHead(200, {'Content-Type':'text/plain'})
    response.end(JSON.stringify(client))
  } else{
    response.writeHead(200, {'Content-Type':'text/plain'})
    response.end(`Client with id ${url.substring(9)} not found`)

  }

}

function apiGetClientFunction(response:http.ServerResponse, url:string){
      const uuid = url.substring(9,45)
     const regexpGetFunctionName = /\/clients\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\/(\w+)(?:\?.*)?/i;
     const matchName = url.match(regexpGetFunctionName)
     let functionName:string
     let msgCullFunction
     if (matchName){
      functionName = matchName[1]
     }else{
      throw new Error('Function name not found')
     }
     const client = getFullClientByID(fullClientsDetails,uuid)
     if (client && client.capacities.find(el=>el===functionName)){
        const urlPath = urlModule.parse(url, true)
        const {query} = urlPath
        if (Object.keys(query).length >0){
          msgCullFunction = {
            data:{
              name:functionName,
              functionArgs: Object.values(query)
            }
          }
          }else{
            msgCullFunction = {
              data:{
                name:functionName,
                functionArgs: []
              }

          }

        }
      server.send(JSON.stringify(msgCullFunction),client.port, client.adress)
      const udpResponsePromise = new Promise((resolve)=>{
        server.on('message', (msg:string, rinfo)=>{
          let msgObj:any = {};
          try{
             msgObj = JSON.parse(msg)
          }catch{
            
          }
          if(isReturnCullFunctionMsg(msgObj)){
            resolve(msgObj.result)
          }
        })
      })

      udpResponsePromise.then((udpResponse)=>{
        response.writeHead(200, {'Content-Type':'text/plain'})
        response.end(`Function: ${functionName} return: ${udpResponse}`)
      }).catch(err=>{
        response.writeHead(500, {'Content-Type':'text/plain'})
        response.end(`Error with function ${functionName}`)
      })
 
      
      
     }else{
      response.writeHead(200, {'Content-Type':'text/plain'})
      response.end(`Client with id: "${uuid}" and function name: "${functionName}" not found`)
     }
 
}


const getClientsDetails = ()=>{
  return fullClientsDetails.map(({id, capacities, icon})=>({id, capacities, icon}))

}

server.on('message', (msg:string, rinfo) => {
    console.log(getCurrentTime() + ` Server got message: ${msg}`)
    
   
    let msgObj:any = {};
    try{
       msgObj = JSON.parse(msg)
    }catch{
      
    }
    
    

    if (isHelloData(msgObj)){
      server.send(HELLO_MSG, rinfo.port, rinfo.address);
      
      const client_data:FULL_CLIENT_DATA = {
        id:msgObj.data.id,
        capacities:msgObj.data.capacities,
        icon:msgObj.data.icon,
        adress:rinfo.address,
        port: rinfo.port,
        timeLastHeartbeat:'',
        isAvaliable: true

      }
      fullClientsDetails.push(client_data)
   
    }else if (isHeartbeat(msgObj)){
      const clientIndex = getClientIndexById(fullClientsDetails,msgObj.clientId)
      if(clientIndex>=0){
        fullClientsDetails[clientIndex].timeLastHeartbeat = getCurrentTime()
      }else{
        console.log(`Client with id: ${msgObj.clientId} not found in full clients list`)
      }
      server.send(HEARTBEAT_MSG, rinfo.port, rinfo.address);
      console.log(fullClientsDetails)

    }else if (isRequestError(msgObj)){

    }else if(isReturnCullFunctionMsg(msgObj)){

    }else{

      server.send(JSON.stringify(errorObj), rinfo.port, rinfo.address)
      console.log(`Некорректное сообщение с адреса ${rinfo.address}, порта ${rinfo.port}`)

    }


    
  

});


const HTTPserver = http.createServer((request, response)=>{
  const {url, method} = request
  console.log(`url: ${url}, method: ${method}`)
  if (method !== 'GET' || url === undefined){
      response.writeHead(404, {'Content-Type':'text/plain'})
      response.end('404')
  }else{
    const route = regRoute.find(([k])=>k.test(url))
    if (route===undefined){
      response.writeHead(404, {'Content-Type':'text/plain'})
      response.end('404')
    }else{
      route[1](response, url)
    }
    
  }


})

HTTPserver.listen(PORT, ()=>{
  console.log('Http server is running')
})





server.bind(PORT, () => {
  server.setBroadcast(true); 
  console.log('UDP server is running');
});

setInterval(()=>{
  checkClientAvaliable()
},15000)

import 'dotenv/config'
import dgram from 'dgram';
import * as serverTypes from './types/serverTypes'
import * as clientTypes from './types/clientTypes'
import * as commonTypes from './types/commonTypes'

const PORT = Number(process.env.PORT)

const server = dgram.createSocket('udp4');
const HELLO_MSG = Buffer.from('HELLO_OK')
const HEARTBEAT_MSG = Buffer.from('HEARTBEAT_OK')
const errorObj:commonTypes.RESULT_ERROR = {data:{
  description:'Uncnown request'
}}
const ok_obj:commonTypes.RESULT_OK = {
  data:{
    descrption:'ok'
  }
}

const CLIENTS_DETAILS: clientTypes.CLIENT_DATA[] = []

function getCurrentTime(){
  const date = new Date()
  return date.toISOString()
}

function isHelloData(obj:any): obj is clientTypes.HELLO_DATA{
  try {
    return typeof obj === 'object' &&
  Array.isArray(obj.data.capacities) &&
  typeof obj.data.id === 'string'
  }
  catch {
    return false
  } 
  
}

function isHeartbeat(obj:clientTypes.HEARTBEAT_DATA){
  try{
    return obj.type === 'HEARTBEAT'
  }catch{
    return false
  }
}


function isRequestError(obj: any): obj is commonTypes.REQUEST_ERROR{
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
const get_clients = ()=>{
  return CLIENTS_DETAILS

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
      
      let client_data:clientTypes.CLIENT_DATA = {
        id:msgObj.data.id,
        capacities:msgObj.data.capacities
      }
      CLIENTS_DETAILS.push(client_data)
   
    }else if (isHeartbeat(msgObj)){
      server.send(HEARTBEAT_MSG, rinfo.port, rinfo.address);
    }else if (isRequestError(msgObj)){

    }else{

      server.send(JSON.stringify(errorObj), rinfo.port, rinfo.address)
      console.log(`Некорректное сообщение с адреса ${rinfo.address}, порта ${rinfo.port}`)

    }


    
  

});





server.bind(PORT, () => {
  server.setBroadcast(true); 
  console.log('Server running');
});

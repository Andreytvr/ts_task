import 'dotenv/config';
import dgram from 'dgram';
import {v4 as uuidv4} from 'uuid';
import { performance } from 'perf_hooks';
import os from 'os';
import fs from 'fs';
import * as clientTypes from './types/clientTypes'
import * as serverTypes from './types/serverTypes'
import * as commonTypes from './types/commonTypes'




const PORT = Number(process.env.PORT)
const clientId = uuidv4()
const pathToImage = './files/pirate.jpg'
const fileImage = fs.readFileSync(pathToImage)
const errorObj:commonTypes.RESULT_ERROR = {data:{
  description:'Uncnown request'
}}
const ok_obj:commonTypes.RESULT_OK = {
  data:{
    descrption:'ok'
  }
}


let serverIsAvailiable = false
let serverFound = false

enum clientFunctions {
    randomNumber = 'randomNumber',
    clientFreeMemory = 'clientFreeMemory',
    hddSpeed = 'hddSpeed'
}

function randomNumber(min: number, max:number){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clientFreeMemory(){
  return os.freemem();
}

async function hddSpeed(){
  const filePath = 'testfile.txt';
  const megabyte = 1024 * 1024; 
  const buffer = Buffer.alloc(megabyte); 

  const start = performance.now(); 

  await fs.promises.writeFile(filePath, buffer); 

  const end = performance.now(); 
  const elapsedTime = end - start; 

  return elapsedTime; 
}


function getCurrentTime(){
  const date = new Date()
  return date.toISOString()
}

function isCallFunctions(obj:any):obj is serverTypes.CALL_FUNCTION_DATA{
  try{
    return (
      typeof obj === 'object' &&
      typeof obj.data === 'object' &&
      typeof obj.data.name === 'string' &&
      Array.isArray(obj.data.functionArgs)
  );


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


function sendMessage(msg: string){
    client.send(msg, PORT, (err) => {
        if (err) {

          console.error('Error sending message: ', err);

        } else {
          console.log(getCurrentTime() + ` Message sent successfully ${msg}`);
        }
      });
      
}

const clientData:clientTypes.HELLO_DATA = {
    data:{
        capacities:[clientFunctions.clientFreeMemory,
             clientFunctions.hddSpeed,
             clientFunctions.randomNumber],
        id:clientId,
        icon:fileImage
        
    }
}

const sendHello:clientTypes.HELLO = (data:clientTypes.HELLO_DATA)=>{
    const jsonData = JSON.stringify(data)
    sendMessage(jsonData)
    return null
}

const sendHeartbeat:clientTypes.HEARTBEAT = ()=>{
  const data = {
    type:'HEARTBEAT'
  }
  sendMessage(JSON.stringify(data))
  return null
}

const getClientDetails = ()=>{
  return clientData
}

const call_function:serverTypes.CALL_FUNCTION = (data:serverTypes.CALL_FUNCTION_DATA)=>{
  let calledFunc = data.data.name
  switch (calledFunc){
    case 'randomNumber':
      console.log('randomNumber')
      return randomNumber(data.data.functionArgs[0],data.data.functionArgs[1])
    case 'clientFreeMemory':
      console.log(clientFreeMemory)
      return clientFreeMemory()
    case 'hddSpeed':
      console.log('hddSpeed')
      return hddSpeed().then((time) => {
                console.log(`Время, затраченное на запись 1 мегабайта нулей: ${time.toFixed(2)} миллисекунд`);
            })
            .catch((error) => {
                console.error('Произошла ошибка:', error);
            });
  }

}





const client = dgram.createSocket('udp4');

client.bind(() => {
    client.setBroadcast(true)
  console.log('Client is running');
});



client.on('message', (msg:string,rinfo)=>{
  let msgObj:any = {};
  try{
     msgObj = JSON.parse(msg)
  }catch{
    
  }
  console.log(`${getCurrentTime()} Client got message: ${msg}`)
  if(msg.toString() === 'HELLO_OK'){
    serverFound = true
    serverIsAvailiable = true
  }else if (msg.toString() === 'HEARTBEAT_OK'){
    serverFound = true
    serverIsAvailiable = true
  }else if(msg.toString()==='GET_CLIENT_DETAILS'){
    client.send(JSON.stringify(ok_obj),rinfo.port, rinfo.address)
    client.send(JSON.stringify(clientData),rinfo.port, rinfo.address)
  }else if (isCallFunctions(msgObj)){
    client.send(JSON.stringify(ok_obj),rinfo.port, rinfo.address)
    call_function(msgObj)
  }else if (isRequestError(msgObj)){

  }
  else{
    client.send(JSON.stringify(errorObj), rinfo.port, rinfo.address)
    
  }



})



sendHello(clientData);



setInterval(()=>{
  if(!serverFound){
    sendHello(clientData);

  }
},20000)



setInterval(()=>{
  if(serverIsAvailiable){
    sendHeartbeat();
    serverIsAvailiable = false;
    serverFound = false
  }
},15000)
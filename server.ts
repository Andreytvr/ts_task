import 'dotenv/config'
import dgram from 'dgram'
import crypto from 'crypto'
import fs from 'fs'
import http from 'http'
import * as urlModule from 'url'
import {HEARTBEAT_DATA, HELLO_DATA, FULL_CLIENT_DATA, CLIENT_DATA, RETURN_CALL_FUNCTION} from './types/clientTypes'
import {RESULT_ERROR, RESULT_OK, REQUEST_ERROR} from './types/commonTypes'

class Server{
    private readonly regRoute: [RegExp,Function][]
    private readonly fullClientsDetails: FULL_CLIENT_DATA[]
    private readonly errorObj:RESULT_ERROR
    private readonly HELLO_MSG: Buffer
    private readonly HEARTBEAT_MSG: Buffer
    private readonly PORT: number
    private readonly httpServer: http.Server
    private readonly udpServer:dgram.Socket
    private readonly interval: NodeJS.Timeout


    constructor(port: number) {
        this.regRoute = [
            [/^\/clients$/i, (response: http.ServerResponse, url: string, headers:http.IncomingHttpHeaders) => this.apiGetClients(response, url, headers)],
            [/^\/clients\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i, (response: http.ServerResponse, url: string, headers: http.IncomingHttpHeaders) => this.apiGetClientById(response, url, headers)],
            [/\/clients\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\/\w+/i, (response: http.ServerResponse, url: string, headers: http.IncomingHttpHeaders) => this.apiGetClientFunction(response, url, headers)]
        ]
        this.fullClientsDetails = []
        this.errorObj = {data:{
            description:'Uncnown request'
          }}
          const ok_obj:RESULT_OK = {
            data:{
              descrption:'ok'
            }
          }
        this.HEARTBEAT_MSG = Buffer.from('HEARTBEAT_OK')
        this.HELLO_MSG = Buffer.from('HELLO_OK')
        this.PORT = port
        this.httpServer = http.createServer(this.httpHandler.bind(this))
        this.udpServer = dgram.createSocket('udp4')
        this.udpServer.on('message',this.handleUdpMessage.bind(this))
        this.interval = setInterval(this.checkClientAvaliable.bind(this),15000)

    }

     @KeyProtected('key.txt')
     private async apiGetClients(response:http.ServerResponse, url:string, headers: http.IncomingHttpHeaders){
        const arrAvaliableClients = this.fullClientsDetails.filter(obj=>obj.isAvaliable === true)
        return [200,JSON.stringify(arrAvaliableClients)]
  
  }
    private isHelloData(obj:any): obj is HELLO_DATA{
    try {
      return typeof obj === 'object' &&
    Array.isArray(obj.data.capacities) &&
    typeof obj.data.id === 'string'
    }
    catch {
      return false
    } 
    
  }
  
    private isHeartbeat(obj:HEARTBEAT_DATA){
    try{
      return obj.type === 'HEARTBEAT'
    }catch{
      return false
    }
  }
  
    private isReturnCullFunctionMsg(obj:RETURN_CALL_FUNCTION ){
    try{
      return obj.type === 'RETURN_CALL_FUNCTION'
    }catch{
      return false
    }
  }
  
  
    private isRequestError(obj: any): obj is REQUEST_ERROR{
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
  
  private getClientByID(arr:CLIENT_DATA[],clientId:string){
    return arr.find(obj => obj.id === clientId)
    
  }
  
  private getFullClientByID(arr:FULL_CLIENT_DATA[],clientId:string){
    return arr.find(obj => obj.id === clientId)
    
  }
  
  private getClientIndexById(arr:FULL_CLIENT_DATA[], clientId:string){
    return arr.findIndex(el=>el.id === clientId)
  }

  private getClientsDetails (){
    return this.fullClientsDetails.map(({id, capacities, icon})=>({id, capacities, icon}))
  
  }
  
  private checkClientAvaliable(){
    const currentTime = new Date().getTime()
    this.fullClientsDetails.forEach(obj=>{
      const timeLastHeartbeat = new Date(obj.timeLastHeartbeat).getTime()
      const timeDifference = currentTime - timeLastHeartbeat
  
      if(timeDifference >=15000){
        obj.isAvaliable = false
      }else{
        obj.isAvaliable = true
      }
    })
  }

  @KeyProtected('key.txt')
  private async apiGetClientById(response:http.ServerResponse, url:string, headers: http.IncomingHttpHeaders){
    const clientDetails = this.getClientsDetails()
    const client = this.getClientByID(clientDetails,url.substring(9))
    if (client){
        return [200,JSON.stringify(client)]
    } else{
        return [200,`Client with id ${url.substring(9)} not found`]
  
    }
  
  }
  
  @KeyProtected('key.txt')
  private async apiGetClientFunction(response:http.ServerResponse, url:string, headers: http.IncomingHttpHeaders){
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
       const client = this.getFullClientByID(this.fullClientsDetails,uuid)
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
        this.udpServer.send(JSON.stringify(msgCullFunction),client.port, client.adress)
        const udpResponsePromise = new Promise((resolve)=>{
            this.udpServer.on('message', (msg:string, rinfo)=>{
            let msgObj:any = {};
            try{
               msgObj = JSON.parse(msg)
            }catch{
              
            }
            if(this.isReturnCullFunctionMsg(msgObj)){
              resolve(msgObj.result)
            }
          })
        })
        
        const clientResponse = await udpResponsePromise
        return [200,`Function: ${functionName} return: ${clientResponse}`]
  
       }else{
            return [200,`Client with id: "${uuid}" and function name: "${functionName}" not found`]
       }
   
  }

    private handleUdpMessage(msg:string, rinfo:dgram.RemoteInfo){
        console.log(new Date + ` Server got message: ${msg}`)
    
   
        let msgObj:any = {};
        try{
           msgObj = JSON.parse(msg)
        }catch{
          
        }
        
    
        if (this.isHelloData(msgObj)){
            this.udpServer.send(this.HELLO_MSG, rinfo.port, rinfo.address);
          
          const client_data:FULL_CLIENT_DATA = {
            id:msgObj.data.id,
            capacities:msgObj.data.capacities,
            icon:msgObj.data.icon,
            adress:rinfo.address,
            port: rinfo.port,
            timeLastHeartbeat:Date.now(),
            isAvaliable: true
    
          }
          this.fullClientsDetails.push(client_data)
       
        }else if (this.isHeartbeat(msgObj)){
          const clientIndex = this.getClientIndexById(this.fullClientsDetails,msgObj.clientId)
          if(clientIndex>=0){
            this.fullClientsDetails[clientIndex].timeLastHeartbeat = Date.now()
          }else{
            console.log(`Client with id: ${msgObj.clientId} not found in full clients list`)
          }
          this.udpServer.send(this.HEARTBEAT_MSG, rinfo.port, rinfo.address);
          console.log(this.fullClientsDetails)
    
        }else if (this.isRequestError(msgObj)){
    
        }else if(this.isReturnCullFunctionMsg(msgObj)){
    
        }else{
    
            this.udpServer.send(JSON.stringify(this.errorObj), rinfo.port, rinfo.address)
          console.log(`Некорректное сообщение с адреса ${rinfo.address}, порта ${rinfo.port}`)
    
        }
    
    }

     private async httpHandler(request:http.IncomingMessage, response:http.ServerResponse){
        const {url, method, headers} = request
        console.log(`url: ${url}, method: ${method}`)
        if (method !== 'GET' || url === undefined){
            response.writeHead(404, {'Content-Type':'text/plain'})
            response.end('404')
        }else{
          const route = this.regRoute.find(([k])=>k.test(url))
          if (route===undefined){
            response.writeHead(404, {'Content-Type':'text/plain'})
            response.end('404')
          }else{
            const [code, msg] = await route[1](response, url, headers)
            response.writeHead(code, {'Content-Type':'text/plain'})
            response.end(msg)
          }

          
        }
      

    }

    public httpServerStart(){
        this.httpServer.listen(this.PORT,()=>{
            console.log('Http server is running')
        })
    }

    public udpServerStart(){
        this.udpServer.bind(this.PORT,()=>{
            this.udpServer.setBroadcast(true)
            console.log('UDP server is running');
        })
    }
}

const port = Number(process.env.PORT)
const myServer = new Server(port)
myServer.httpServerStart()
myServer.udpServerStart()

  function KeyProtected(keyPath:string){
    return function<This, Args extends any[]>(
      target:(this: This, ...args: Args) => Promise<any[]>,
      context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<any[]> >
    ) {
      return async function(this:This, ...args:Args): Promise<any[]>{
        const res = target.call(this, ...args)
        const headers = args[2]
        let clientHashKey
        let serverHashKey
        let keyFile
        let pathToKey
        if(!('authkey' in headers)){
            return [403, 'UNAUTHORIZED']
        }else{
            clientHashKey = sha256Hash(headers.authkey)
        }
             if (isDirectory(keyPath)){
            console.log('This is directory')
            keyFile = findFile(keyPath)
            if(keyFile.length === 0){
                throw new Error('Key file not found')
            }else{
                pathToKey = keyPath + keyFile[0]
            }
        }
        else{
            pathToKey = keyPath
    
        }
        const serverKey = readFile(pathToKey)
        if(!serverKey){
            throw new Error(`Auth key not found in file ${pathToKey}`)
    
        }else if(serverKey.length < 8){
            throw new Error(`KEY_TOO_SHORT`)
        }else if (serverKey.length > 255){
            throw new Error(`KEY_TOO_LONG`)
        }else{
            
            serverHashKey = sha256Hash(serverKey)
        }
        console.log(`Client hash key ${clientHashKey}`)
        console.log(`Server hash key ${serverHashKey}`)
        if (serverHashKey === clientHashKey){
            return res
        }else{
            return [403, 'UNAUTHORIZED']
        }
        
      }
    }
}


  function isDirectory(keyPath:fs.PathLike){
      try {
        const stat = fs.statSync(keyPath);
        return stat.isDirectory();
    } catch (error) {
       throw new Error('Error checking directory')
    }
  }
  
  function findFile(keyPath:fs.PathLike){
      const files = fs.readdirSync(keyPath);
      const file = files.filter(file=>file==='key.txt')
      return file

    }
  
   function readFile(keyPath:fs.PathLike){
      try {
        const data = fs.readFileSync(keyPath, 'utf8')
        return data
    
    } catch (err) {
        throw new Error('Error reading file')
    }
    }

    function sha256Hash(key:string){
        const hash = crypto.createHash('sha256');
        hash.update(key);
        return hash.digest('hex');
    }
  
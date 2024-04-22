
export type HELLO_DATA = {
    data:{
      capacities: string[],
      id:string,
      icon: Buffer
  
    }
  }
  

export type CLIENTS_DATA = [
    {
      id: string,
      capacities: string[] 
    }
  ]

export type CLIENT_DATA = 
    {
      id: string,
      capacities: string[] 
    }
  
  
export type FULL_CLIENT_DATA = {
  id: string
  capacities: string[]
  icon?: Buffer
  adress: string
  port: number
  timeLastHeartbeat:string
  isAvaliable: boolean
}  

export type RETURN_CALL_FUNCTION = {
  type:'RETURN_CALL_FUNCTION'
  result:any
}
export type GET_CLIENTS = () =>CLIENTS_DATA
  
export type HELLO = (data:HELLO_DATA)=>null;
  
export type HEARTBEAT = ()=>null;

export type HEARTBEAT_DATA = {
  type:'HEARTBEAT',
  clientId:string
}



  

  
  
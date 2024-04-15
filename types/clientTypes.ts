
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
  
  
export type GET_CLIENTS = () =>CLIENTS_DATA
  
export type HELLO = (data:HELLO_DATA)=>null;
  
export type HEARTBEAT = ()=>null;

export type HEARTBEAT_DATA = {
  type:'HEARTBEAT'
}



  

  
  
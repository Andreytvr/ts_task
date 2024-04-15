export type GET_CLIENT_DATA = {
    
        id: string ,
        capacities: string[],
        icon?: Buffer
    
}
export type CALL_FUNCTION_DATA = {
    data: {
		name: string,
		functionArgs: any[]
    }
 	
}
export type GET_CLIENT_DETAILS = ()=> GET_CLIENT_DATA
export type CALL_FUNCTION = (data:CALL_FUNCTION_DATA) => any
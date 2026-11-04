// Report server render failures without request bodies, cookies or credentials.
export function onRequestError(error:unknown,request:{path?:string},context:{routePath?:string}) {
 console.error('Server render failed',request.path??context.routePath??'',error instanceof Error?error.stack:String(error));
}

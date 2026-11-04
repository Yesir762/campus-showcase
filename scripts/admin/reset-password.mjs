// Read sensitive values from environment/stdin; never pass them in command arguments.
import {stdin} from 'node:process';
const site=process.env.SITE_URL?.replace(/\/$/,''),token=process.env.ADMIN_SETUP_TOKEN,username=process.env.ADMIN_USERNAME;
if(!site||!token||!username)throw Error('Set SITE_URL, ADMIN_SETUP_TOKEN and ADMIN_USERNAME; pipe the new password through stdin.');
if(!site.startsWith('https://')&&!/^http:\/\/(localhost|127\.0\.0\.1):/.test(site))throw Error('HTTPS required');
let password='';for await(const chunk of stdin){password+=chunk;if(password.length>1024)throw Error('Password too long');}password=password.trimEnd();
const r=await fetch(`${site}/api/admin/recovery`,{method:'POST',redirect:'error',headers:{Origin:new URL(site).origin,'Content-Type':'application/json','X-Admin-Request':'1'},body:JSON.stringify({username,password,token})});
if(!r.ok)throw Error((await r.json()).error);console.log('Password reset. All existing sessions revoked.');

// Remove only generated build copies; originals remain intact under public/models.
import {rm} from 'node:fs/promises';
await rm(new URL('../../dist/client/models/',import.meta.url),{recursive:true,force:true});
console.log('Model payloads excluded from Worker archive; seed them into R2 after deployment.');

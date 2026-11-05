const { getBhavData } = require('./services/nse-bhavcopy');

// Patch: intercept at parseCsv level by fetching raw
const https = require('https');
const zlib  = require('zlib');

async function peekCsv() {
  // Get session
  const cookies = await new Promise(resolve => {
    https.get('https://www.nseindia.com/', {
      headers: { 'User-Agent':'Mozilla/5.0 Chrome/120.0.0.0' }
    }, res => {
      const c = (res.headers['set-cookie']||[]).map(x=>x.split(';')[0]).join('; ');
      res.on('data',()=>{}); res.on('end', ()=>resolve(c));
    }).on('error',()=>resolve(''));
  });
  console.log('Cookies:', cookies.substring(0,80));

  const today = new Date();
  for (let back=0; back<=4; back++) {
    const d = new Date(today); d.setDate(d.getDate()-back);
    if (d.getDay()===0||d.getDay()===6) continue;
    const dd = String(d.getDate()).padStart(2,'0');
    const mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
    const yyyy = d.getFullYear();
    const url = `https://nsearchives.nseindia.com/content/historical/EQUITIES/${yyyy}/${mon}/cm${dd}${mon}${yyyy}bhav.csv.zip`;
    console.log('Trying:', url);
    
    const buf = await new Promise((resolve,reject) => {
      https.get(url, { headers:{ 'User-Agent':'Mozilla/5.0 Chrome/120.0.0.0','Referer':'https://www.nseindia.com/','Cookie':cookies,'Accept-Encoding':'identity'}}, res => {
        console.log('  Status:', res.statusCode);
        if (res.statusCode!==200) return resolve(null);
        const ch=[]; res.on('data',c=>ch.push(c)); res.on('end',()=>resolve(Buffer.concat(ch)));
      }).on('error',e=>{console.log('  Err:',e.message);resolve(null);});
    });
    if (!buf) continue;
    
    // Unzip
    await new Promise((resolve) => {
      let off=0;
      while(off<buf.length-30){
        if(buf.readUInt32LE(off)!==0x04034b50){off++;continue;}
        const method=buf.readUInt16LE(off+8);
        const cSize=buf.readUInt32LE(off+18);
        const nLen=buf.readUInt16LE(off+26);
        const eLen=buf.readUInt16LE(off+28);
        const data=buf.slice(off+30+nLen+eLen, off+30+nLen+eLen+cSize);
        if(method===8){
          zlib.inflateRaw(data,(err,out)=>{
            if(err){console.log('  Inflate err:',err.message);return resolve();}
            const lines=out.toString('utf8').split('\n');
            console.log('  HEADERS:', lines[0]);
            console.log('  ROW1:   ', lines[1]);
            console.log('  Total lines:', lines.length);
            resolve();
          });
          return;
        }
        off++;
      }
      resolve();
    });
    break;
  }
}
peekCsv().catch(e=>console.log('FAIL:',e.message));

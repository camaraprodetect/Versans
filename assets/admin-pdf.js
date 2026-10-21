/* Versans A4 PDF export, self-contained. Renders RTL Hebrew directly using the browser's fonts.
   No third-party services and no print dialog are needed for downloading. */
(function(){
  'use strict';
  var W=1240, H=1754, X=80, RIGHT=W-X, TOP=294, BOTTOM=1638;
  var C={ink:'#142333',muted:'#657483',pale:'#eef2f5',line:'#d4dfe6',white:'#ffffff',alt:'#f7f9fa',warn:'#9b501c'};
  function txt(v){return String(v===null||v===undefined?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').trim();}
  function font(ctx,size,bold){ctx.font=(bold?'700 ':'400 ')+size+'px Arial, "Noto Sans Hebrew", sans-serif';ctx.textBaseline='top';ctx.direction='rtl';ctx.textAlign='right';}
  function colorText(ctx,s,x,y,size,bold,color){font(ctx,size,bold);ctx.fillStyle=color||C.ink;ctx.fillText(txt(s),x,y);}
  function wrap(ctx,value,width,size){
    font(ctx,size,false);
    var valueString=txt(value)||'-';
    var words=valueString.split(/\s+/),out=[],line='';
    function putWord(word){
      if(!word)return;
      if(ctx.measureText(word).width<=width){
        var candidate=line?line+' '+word:word;
        if(line && ctx.measureText(candidate).width>width){out.push(line);line=word;}else line=candidate;
        return;
      }
      if(line){out.push(line);line='';}
      var piece='';
      for(var j=0;j<word.length;j++){
        if(piece&&ctx.measureText(piece+word[j]).width>width){out.push(piece);piece='';}
        piece+=word[j];
      }
      line=piece;
    }
    words.forEach(putWord);
    if(line)out.push(line);
    return out.length?out:['-'];
  }
  function jpegBytes(canvas){
    var url=canvas.toDataURL('image/jpeg',0.86);
    var raw=atob(url.substring(url.indexOf(',')+1));
    var bytes=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return bytes;
  }
  function pdfBlob(images){
    var out=[],offsets=[0],length=0,encoder=new TextEncoder();
    function piece(bytes){out.push(bytes);length+=bytes.byteLength;}
    function str(s){piece(encoder.encode(s));}
    function start(id){offsets[id]=length;str(id+' 0 obj\n');}
    function finish(){str('endobj\n');}
    str('%PDF-1.4\n%VerSans\n');
    start(1);str('<< /Type /Catalog /Pages 2 0 R >>\n');finish();
    var kids=images.map(function(_,i){return (3+i*3)+' 0 R';}).join(' ');
    start(2);str('<< /Type /Pages /Kids ['+kids+'] /Count '+images.length+' >>\n');finish();
    images.forEach(function(image,i){
      var page=3+i*3,content=page+1,picture=page+2;
      start(page);
      str('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /Im0 '+picture+' 0 R >> >> /Contents '+content+' 0 R >>\n');finish();
      var commands='q\n595.276 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
      start(content);str('<< /Length '+commands.length+' >>\nstream\n'+commands+'endstream\n');finish();
      start(picture);
      str('<< /Type /XObject /Subtype /Image /Width '+W+' /Height '+H+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+image.byteLength+' >>\nstream\n');
      piece(image);str('\nendstream\n');finish();
    });
    var xref=length,objectCount=2+images.length*3;
    str('xref\n0 '+(objectCount+1)+'\n0000000000 65535 f \n');
    for(var id=1;id<=objectCount;id++)str(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
    str('trailer\n<< /Size '+(objectCount+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
    return new Blob(out,{type:'application/pdf'});
  }
  function createPages(data,selected,params){
    var names=selected.filter(function(key){return data.columns.some(function(c){return c.key===key;});});
    if(!names.length)throw new Error('לא נמצאו עמודות לדוח');
    var labels={};data.columns.forEach(function(c){labels[c.key]=txt(c.label);});
    var pages=[],pageNum=0,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
    var ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('הדפדפן לא תומך ביצירת PDF');
    var y=TOP,wide=names.length>4&&!params.forceTable,cellWidth=(W-2*X)/(params.forceTable?names.length:Math.min(names.length,4)),lineH=27;
    var range=(params.from||params.to)?'טווח: '+(params.from||'התחלה')+' עד '+(params.to||'היום'):'כל התאריכים';
    var when=new Date(data.generatedAt||Date.now()).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'});
    var summaries=Array.isArray(data.summary)?data.summary:[];
    function begin(){
      pageNum++;
      ctx.fillStyle=C.white;ctx.fillRect(0,0,W,H);
      ctx.fillStyle=C.ink;ctx.fillRect(0,0,W,13);
      ctx.direction='ltr';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle=C.ink;ctx.font='700 42px Georgia,serif';ctx.fillText('VERSANS',X,75);
      colorText(ctx,'דוח ניהול פנימי · לעיון מורשים בלבד',RIGHT,85,20,false,C.muted);
      ctx.strokeStyle=C.line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(X,144);ctx.lineTo(RIGHT,144);ctx.stroke();
      colorText(ctx,data.title||'דוח',RIGHT,172,36,true,C.ink);
      colorText(ctx,range+'  ·  '+(data.rows||[]).length+' רשומות  ·  '+when,RIGHT,225,19,false,C.muted);
      ctx.beginPath();ctx.moveTo(X,1680);ctx.lineTo(RIGHT,1680);ctx.stroke();
      colorText(ctx,'עמוד '+pageNum,RIGHT,1692,17,false,C.muted);
      ctx.direction='ltr';ctx.textAlign='left';ctx.font='16px Arial';ctx.fillText('VERSANS / INTERNAL REPORT',X,1692);
      y=TOP;
      if(summaries.length){
        var summaryText=summaries.map(function(item){return txt(item.label)+': '+txt(item.value);}).join('   |   ');
        var lines=wrap(ctx,summaryText,W-2*X-10,20);
        lines.forEach(function(line){colorText(ctx,line,RIGHT-4,y,20,true,C.ink);y+=32;});
        y+=24;
      }
    }
    function next(){if(pageNum)pages.push(jpegBytes(canvas));begin();}
    function need(h){if(y+h>BOTTOM)next();}
    function tableHeader(){
      ctx.fillStyle=C.pale;ctx.fillRect(X,y,W-2*X,54);
      names.forEach(function(k,i){colorText(ctx,labels[k],RIGHT-i*cellWidth-12,y+16,19,true,C.ink);});
      y+=54;
    }
    function drawTable(row,index){
      var vals=names.map(function(k){return wrap(ctx,row[k],cellWidth-22,19);});
      var h=18+Math.max.apply(null,vals.map(function(v){return v.length;}))*lineH;
      if(h>900){drawCard(row,index);return;}
      if(y+h>BOTTOM){next();tableHeader();}
      ctx.fillStyle=index%2?C.alt:C.white;ctx.fillRect(X,y,W-2*X,h);
      ctx.strokeStyle=C.line;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(X,y+h);ctx.lineTo(RIGHT,y+h);ctx.stroke();
      vals.forEach(function(lines,i){lines.forEach(function(line,j){colorText(ctx,line,RIGHT-i*cellWidth-12,y+10+j*lineH,19,false,C.ink);});});
      y+=h;
    }
    function drawCard(row,index){
      var left=RIGHT,half=(W-2*X)/2,gap=18;
      need(67);
      ctx.fillStyle=C.pale;ctx.fillRect(X,y,W-2*X,46);
      colorText(ctx,'רשומה '+(index+1),RIGHT-14,y+11,21,true,C.ink);
      y+=46;
      for(var i=0;i<names.length;i+=2){
        var fields=[names[i],names[i+1]].filter(Boolean);
        var lines=fields.map(function(key){return wrap(ctx,row[key],half-35,19);});
        var max=Math.max.apply(null,lines.map(function(l){return l.length;}));
        var cursor=0;
        while(cursor<max){
          if(y+65>BOTTOM)next();
          var maxLines=Math.max(1,Math.floor((BOTTOM-y-47)/lineH));
          var count=Math.min(max-cursor,maxLines);
          var h=42+count*lineH;
          ctx.fillStyle=index%2?C.alt:C.white;ctx.fillRect(X,y,W-2*X,h);
          ctx.strokeStyle=C.line;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(X,y+h);ctx.lineTo(RIGHT,y+h);ctx.stroke();
          fields.forEach(function(key,j){
            var x=left-j*half-gap;
            colorText(ctx,labels[key]+(cursor?' (המשך)':''),x,y+9,16,true,C.muted);
            lines[j].slice(cursor,cursor+count).forEach(function(line,l){colorText(ctx,line,x,y+34+l*lineH,19,false,C.ink);});
          });
          y+=h;cursor+=count;
        }
      }
      y+=16;
    }
    begin();
    if(data.truncated){
      var warn='הדוח מוגבל ל־'+data.limit+' רשומות. ניתן לצמצם תוצאות באמצעות מסננים.';
      colorText(ctx,warn,RIGHT,y,19,true,C.warn);y+=48;
    }
    if(!data.rows.length){colorText(ctx,'אין נתונים להצגה בטווח שנבחר',RIGHT,y+40,25,false,C.muted);}
    else if(wide){data.rows.forEach(drawCard);}
    else {tableHeader();data.rows.forEach(drawTable);}
    pages.push(jpegBytes(canvas));
    return pages;
  }
  async function download(data,selected,params){
    if(!data||!Array.isArray(data.rows)||!Array.isArray(data.columns))throw new Error('נתוני הדוח אינם תקינים');
    var pages=createPages(data,selected,params);
    var blob=pdfBlob(pages),url=URL.createObjectURL(blob);
    var name='Versans-'+String(params.type||'report').replace(/[^a-z0-9_-]/gi,'')+'-'+(params.from||'all')+'-'+(params.to||'all')+'.pdf';
    var a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},60000);
    return {pages:pages.length,bytes:blob.size};
  }
  window.VersansReportPDF={download:download};
})();

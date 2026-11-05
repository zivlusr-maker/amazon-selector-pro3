const MODEL='gemini-3.8-flash';
const ENDPOINT=`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_PROMPT=120000,MAX_IMAGE=3500000;

function send(res,status,data){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(data);
}

function safeError(status,data){
  if(status===400)return '请求内容不符合 Gemini API 要求';
  if(status===401||status===403)return 'Gemini API Key 无效、受限或没有该模型权限';
  if(status===429)return 'Gemini API 配额已用完或请求过于频繁，请稍后重试';
  if(status>=500)return 'Gemini 服务暂时不可用，请稍后重试';
  return data?.error?.message||`Gemini 请求失败（HTTP ${status}）`;
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return send(res,405,{error:'仅支持 POST 请求'});

  const key=process.env.GeminiKey;
  if(!key){
    console.error('ziv-analyze: GeminiKey missing');
    return send(res,500,{error:'服务端尚未配置 GeminiKey'});
  }

  let body=req.body;
  try{
    if(typeof body==='string')body=JSON.parse(body);
    if(!body||typeof body!=='object')body={};
  }catch{
    return send(res,400,{error:'请求 JSON 无效'});
  }

  const prompt=typeof body.prompt==='string'?body.prompt.trim():'';
  const system=typeof body.system==='string'?body.system.trim():'';
  const responseType=body.responseType==='text'?'text':'json';

  if(!prompt)return send(res,400,{error:'缺少分析内容'});
  if(prompt.length>MAX_PROMPT||system.length>MAX_PROMPT){
    return send(res,413,{error:'分析内容过长，请缩短后重试'});
  }

  const parts=[{text:prompt}];
  if(body.image){
    const data=typeof body.image.data==='string'?body.image.data:'';
    const mimeType=typeof body.image.mimeType==='string'?body.image.mimeType:'image/jpeg';
    if(!data||data.length>MAX_IMAGE)return send(res,413,{error:'图片为空或过大，请压缩后重试'});
    if(!/^image\/(png|jpeg|webp|heic|heif)$/i.test(mimeType))return send(res,415,{error:'不支持该图片格式'});
    parts.push({inline_data:{mime_type:mimeType,data}});
  }

  const payload={
    contents:[{role:'user',parts}],
    generationConfig:{
      responseMimeType:responseType==='json'?'application/json':'text/plain',
      maxOutputTokens:responseType==='json'?8192:1200,
      temperature:.2
    }
  };
  if(system)payload.system_instruction={parts:[{text:system}]};

  console.log('ziv-analyze:start',JSON.stringify({
    responseType,
    hasImage:!!body.image,
    promptLength:prompt.length
  }));

  try{
    const upstream=await fetch(ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify(payload)
    });
    const data=await upstream.json().catch(()=>({}));

    if(!upstream.ok){
      console.error('ziv-analyze:upstream',upstream.status,data?.error?.status||'unknown');
      return send(res,upstream.status,{error:safeError(upstream.status,data)});
    }

    const text=(data.candidates?.[0]?.content?.parts||[])
      .map(part=>part.text||'')
      .join('')
      .trim();

    if(!text){
      console.error('ziv-analyze:no-text',JSON.stringify(data?.promptFeedback||{}));
      return send(res,502,{error:'Gemini 未返回可用结果'});
    }

    if(responseType==='text')return send(res,200,{result:text});

    try{
      return send(res,200,{result:JSON.parse(text.replace(/```json|```/g,'').trim())});
    }catch(error){
      console.error('ziv-analyze:json-parse',error.message);
      return send(res,502,{error:'Gemini 返回的数据格式异常，请重试'});
    }
  }catch(error){
    console.error('ziv-analyze:network',error.message);
    return send(res,502,{error:'无法连接 Gemini 服务，请稍后重试'});
  }
};

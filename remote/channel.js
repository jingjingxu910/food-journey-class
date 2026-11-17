import {cloudDb} from '../student-data.js?v=20261116-tablet-fixes';
import {readDocument,roundId} from '../evaluation-data.js?v=20261113-awards';
export const stages=['课题封面','初始模型','AR观察','修正模型','实体拼装','食物旅行','课堂研讨','小组自评','专属奖状'];
export const phases=['cover','v1','observation','v2','assembly','journey','discussion','evaluation','awards'];
export const round=roundId;
export async function readDisplayRecord(id){
 try{return await readDocument(id);}
 catch(directError){
  try{
   const db=await cloudDb();
   const result=await db.collection('food-journey-groups').where({_id:id}).limit(1).get();
   if(result?.code)throw result;
   return result?.data?.[0]||{};
  }catch(queryError){
   const describe=error=>typeof error==='string'?error:
    [error?.code||error?.errCode,error?.message||error?.errMsg||error?.cause?.message].filter(Boolean).join(' · ')||'请求未返回详情';
   throw Error(describe(directError)+'，备用查询：'+describe(queryError));
  }
 }
}
export const readRemote=()=>readDisplayRecord('class-display-remote');
export const readLease=()=>readDisplayRecord('class-display-lease');
export async function writeRemote(value){
 const db=await cloudDb();
 const result=await db.collection('food-journey-groups').doc('class-display-remote').set(value);
 if(result?.code||!(result?.updated>0||result?.upsertedId||result?.id))throw Error('控制状态未保存');
}

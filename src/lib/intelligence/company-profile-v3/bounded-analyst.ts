import { companyAnalystResultSchema, type CompanyAnalystResult } from "./company-analyst.ts";

export async function runBoundedCompanyAnalyst<TFollowUp>(input:{
  analyze:(round:1|2, context?:{roundOne:CompanyAnalystResult;followUp:TFollowUp})=>Promise<CompanyAnalystResult>;
  research:(requests:CompanyAnalystResult["researchRequests"])=>Promise<TFollowUp>;
  validate:(result:CompanyAnalystResult,round:1|2,followUp?:TFollowUp)=>void;
}) {
  const roundOne=companyAnalystResultSchema.parse(await input.analyze(1));
  input.validate(roundOne,1);
  if(roundOne.status==="complete") return {result:roundOne,rounds:1 as const,followUp:null};
  const followUp=await input.research(roundOne.researchRequests.slice(0,3));
  const rawRoundTwo=companyAnalystResultSchema.parse(await input.analyze(2,{roundOne,followUp}));
  const result:CompanyAnalystResult=rawRoundTwo.status==="complete"?rawRoundTwo:companyAnalystResultSchema.parse({...rawRoundTwo,status:"complete",researchRequests:[],uncertainties:[...new Set([...rawRoundTwo.uncertainties,...rawRoundTwo.researchRequests.map(({question})=>question)])].slice(0,6)});
  input.validate(result,2,followUp);
  return {result,rounds:2 as const,followUp};
}

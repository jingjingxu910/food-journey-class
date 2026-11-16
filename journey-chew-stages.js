export const chewForms=['whole','chunks','pieces','bolus'];
export const chewLabels=['一块饼干','湿润的大碎块','湿润的小碎块','湿润的食团'];
export function chewStep(elapsed){
 return Math.max(0,Math.min(3,1+Math.floor(elapsed/1.5)));
}

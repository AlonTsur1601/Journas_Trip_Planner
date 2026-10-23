import type {Task} from './types';
export type PendingTaskState=Record<string,{checked:boolean;saving:boolean}>;
/** Every visible task effect reads the same local choice while its save is pending. */
export function optimisticTaskList(tasks:Task[],pending:PendingTaskState){return tasks.map(task=>pending[task.id]?{...task,checked:pending[task.id].checked}:task);}

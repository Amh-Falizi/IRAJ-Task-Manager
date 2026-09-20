import { apiFetchRaw } from './api';
import { Task } from '../types';

export interface SaveTaskOptions {
  taskData: Partial<Task>;
  editingTaskId?: string | null;
  onSuccess?: () => void;
  toast?: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export async function saveTask({ taskData, editingTaskId, onSuccess, toast }: SaveTaskOptions): Promise<boolean> {
  const isEdit = Boolean(editingTaskId);
  const url = isEdit ? `/api/tasks/${editingTaskId}` : '/api/tasks';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await apiFetchRaw(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskData)
    });

    if (res.ok) {
      if (onSuccess) onSuccess();
      if (toast) toast.success(isEdit ? 'Task updated' : 'Task created');
      return true;
    } else {
      const errData = await res.text();
      if (toast) toast.error(`Failed to save task: ${errData}`);
      return false;
    }
  } catch (err: any) {
    console.error('Error saving task:', err);
    if (toast) toast.error(`Error saving task: ${err?.message || 'Unknown error'}`);
    return false;
  }
}

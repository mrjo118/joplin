// Service to queue note reorder operations and execute them sequentially.
// This allows fire-and-forget UI updates while ensuring the underlying model
// stays consistent by processing operations in order.

import Note from '@joplin/lib/models/Note';

interface ReorderOperation {
	folderId: string;
	noteIds: string[];
	targetIndex: number;
	uncompletedTodosOnTop: boolean;
	showCompletedTodos: boolean;
}

class NoteReorderQueue {
	private queue: ReorderOperation[] = [];
	private isProcessing = false;

	public enqueue(
		folderId: string,
		noteIds: string[],
		targetIndex: number,
		uncompletedTodosOnTop: boolean,
		showCompletedTodos: boolean,
	): void {
		this.queue.push({
			folderId,
			noteIds,
			targetIndex,
			uncompletedTodosOnTop,
			showCompletedTodos,
		});
		void this.processQueue();
	}

	private async processQueue(): Promise<void> {
		if (this.isProcessing) return;
		if (this.queue.length === 0) return;

		this.isProcessing = true;

		while (this.queue.length > 0) {
			const operation = this.queue.shift();
			if (!operation) continue;

			try {
				await Note.insertNotesAt(
					operation.folderId,
					operation.noteIds,
					operation.targetIndex,
					operation.uncompletedTodosOnTop,
					operation.showCompletedTodos,
				);
			} catch (error) {
				console.error('Error processing note reorder operation:', error);
			}
		}

		this.isProcessing = false;
	}
}

const noteReorderQueue = new NoteReorderQueue();
export default noteReorderQueue;

import { act, renderHook } from '@testing-library/react';
import AsyncActionQueue from '@joplin/lib/AsyncActionQueue';
import Note from '@joplin/lib/models/Note';
import { defaultFormNote, FormNote } from './types';
import useScheduleSaveCallbacks from './useScheduleSaveCallbacks';

describe('useScheduleSaveCallbacks', () => {
	it.each([
		['while the note is reloading', true],
		['after a newer generation has loaded', false],
	])('should discard saves queued before a sync reload %s', async (_description, isReloading) => {
		const queuedFormNote: FormNote = {
			...defaultFormNote(),
			id: 'note-id',
			body: 'Local edit',
			saveActionQueue: new AsyncActionQueue(0),
			reloadGeneration: 0,
		};
		const currentFormNote: FormNote = {
			...queuedFormNote,
			body: 'Remote edit',
			isReloading,
			reloadGeneration: 1,
		};
		const formNoteRef = { current: currentFormNote };
		const saveSpy = jest.spyOn(Note, 'save');

		const hook = renderHook(() => useScheduleSaveCallbacks({
			setFormNote: { current: jest.fn() },
			formNote: formNoteRef,
			editorId: 'editor-id',
			dispatch: jest.fn(),
			editorRef: { current: null },
		}));

		await act(async () => {
			await hook.result.current.scheduleSaveNote(queuedFormNote);
		});

		expect(saveSpy).not.toHaveBeenCalled();
		saveSpy.mockRestore();
		hook.unmount();
	});
});

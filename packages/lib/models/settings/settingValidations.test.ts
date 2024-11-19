import SyncTargetRegistry from '../../SyncTargetRegistry';
import { createNTestNotes, setupDatabaseAndSynchronizer, switchClient } from '../../testing/test-utils';
import BaseItem from '../BaseItem';
import Folder from '../Folder';
import Setting from '../Setting';
import settingValidations from './settingValidations';

describe('settingValidations', () => {
	beforeEach(async () => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
	});

	test('sync disabled items should prevent switching sync targets unless ignored', async () => {
		const folder = await Folder.save({ title: 'Test' });
		const noteCount = 5;
		const testNotes = await createNTestNotes(noteCount, folder);
		const syncTargetId = SyncTargetRegistry.nameToId('memory');
		Setting.setValue('sync.target', syncTargetId);

		for (const testNote of testNotes) {
			await BaseItem.saveSyncDisabled(syncTargetId, testNote, 'Disabled reason');
		}

		const newSyncTargetId = SyncTargetRegistry.nameToId('dropbox');
		// Validation should fail with some error message.
		expect(await settingValidations(['sync.target'], { 'sync.target': newSyncTargetId })).not.toBe('');

		// Should pass after dismissing all warnings
		for (const testNote of testNotes) {
			await BaseItem.ignoreItemSyncWarning(syncTargetId, testNote);
		}
		expect(await settingValidations(['sync.target'], { 'sync.target': newSyncTargetId })).toBe('');
	});

	test.each(
		['', 0, -1, '1-1', 'aaa', 731, 1e20],
	)('should return error message for invalid integer values', async (input) => {
		const value = await settingValidations(['revisionService.ttlDays'], { 'revisionService.ttlDays': input });
		expect(value).toBe('Keep note history for must be a valid integer between 1 and 730');
	});

	test.each(
		[1, 300, 730],
	)('should return empty string for valid integer values', async (input) => {
		const value = await settingValidations(['revisionService.ttlDays'], { 'revisionService.ttlDays': input });
		expect(value).toBe('');
	});
});

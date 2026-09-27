import * as React from 'react';

import { _ } from '@joplin/lib/locale';
import { act, fireEvent, render, waitFor } from '../../../../utils/testing/testingLibrary';
import { expect, describe, beforeEach, test, jest } from '@jest/globals';
import { createNTestNotes, setupDatabaseAndSynchronizer, switchClient } from '@joplin/lib/testing/test-utils';
import Folder from '@joplin/lib/models/Folder';
import configScreenStyles from '../configScreenStyles';
import { type ShareOptions } from 'react-native-share';
import Setting from '@joplin/lib/models/Setting';
import NoteExportButton from './NoteExportButton';
import Resource from '@joplin/lib/models/Resource';
import Note from '@joplin/lib/models/Note';
import { Alert } from 'react-native';

jest.mock('react-native-share', () => {
	const Share = {
		open: (_options: ShareOptions) => jest.fn(),
	};
	return Share;
});

describe('NoteExportButton', () => {
	beforeEach(async () => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);

		const folder1 = await Folder.save({ title: 'folder1' });
		await createNTestNotes(10, folder1);

		const folder2 = await Folder.save({ title: 'Folder 2 🙂' });
		await createNTestNotes(10, folder2);
	});

	test('should show "Exported successfully!" after clicking "Export"', async () => {
		const styles = configScreenStyles(Setting.THEME_DARK);
		const view = render(<NoteExportButton
			styles={styles}
		/>);

		const exportButton = view.getByText(_('Export all notes as JEX'));
		await act(() => fireEvent.press(exportButton));

		await waitFor(() =>
			expect(view.queryByText(_('Exported successfully!'))).not.toBeNull(),
		);

		// With the default folder setup, there should be no warnings
		expect(view.queryByText(/Warnings/g)).toBeNull();

		view.unmount();
	});

	test('should warn when an attachment has not been downloaded', async () => {
		const folder = (await Folder.all())[0];
		const resource = await Resource.save({ title: 'attachment.txt', filename: 'attachment.txt', mime: 'text/plain' });
		await Note.save({
			title: 'Note with missing attachment',
			parent_id: folder.id,
			body: `[attachment](:/${resource.id})`,
		});
		const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
		const view = render(<NoteExportButton styles={configScreenStyles(Setting.THEME_DARK)} />);

		await act(() => fireEvent.press(view.getByText(_('Export all notes as JEX'))));

		await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
			_('Warning: Some attachments were not exported, because they are not downloaded on your device'),
		));

		view.unmount();
	});
});

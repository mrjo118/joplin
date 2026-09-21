import { ResourceEntity } from '@joplin/lib/services/database/types';
import Resource from '@joplin/lib/models/Resource';
import shim from '@joplin/lib/shim';
import { buildResourceMarkdownLink, deleteResourceLocally, nextSortState } from './resourceScreenUtils';

describe('resourceScreenUtils', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	test.each([
		['title', 'asc', 'title', { sortField: 'title', sortDirection: 'desc' }],
		['size', 'desc', 'size', { sortField: 'size', sortDirection: 'asc' }],
		['title', 'asc', 'size', { sortField: 'size', sortDirection: 'desc' }],
		['size', 'asc', 'title', { sortField: 'title', sortDirection: 'desc' }],
	] as const)('nextSortState(%s, %s, %s) should return %j', (currentField, currentDirection, nextField, expectedState) => {
		expect(nextSortState(currentField, currentDirection, nextField)).toEqual(expectedState);
	});

	test.each([
		[
			{
				id: 'c78cfd6ea4de4be694eccae146a42d99',
				title: 'photo.jpg',
				mime: 'image/jpeg',
			} as ResourceEntity,
			'![photo.jpg](:/c78cfd6ea4de4be694eccae146a42d99)',
		],
		[
			{
				id: '11111111111111111111111111111111',
				title: 'screenshot.png',
				mime: 'image/png',
			} as ResourceEntity,
			'![screenshot.png](:/11111111111111111111111111111111)',
		],
		[
			{
				id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
				title: '[spec](x)',
				mime: 'application/pdf',
			} as ResourceEntity,
			'[\\[spec\\](x)](:/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa)',
		],
		[
			{
				id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
				title: 'archive.zip',
				mime: 'application/zip',
			} as ResourceEntity,
			'[archive.zip](:/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb)',
		],
		[
			{
				id: '22222222222222222222222222222222',
				title: 'notes.txt',
				mime: 'text/plain',
			} as ResourceEntity,
			'[notes.txt](:/22222222222222222222222222222222)',
		],
		[
			{
				id: '33333333333333333333333333333333',
				title: 'voice.mp3',
				mime: 'audio/mpeg',
			} as ResourceEntity,
			'[voice.mp3](:/33333333333333333333333333333333)',
		],
		[
			{
				id: '44444444444444444444444444444444',
				title: 'clip.mp4',
				mime: 'video/mp4',
			} as ResourceEntity,
			'[clip.mp4](:/44444444444444444444444444444444)',
		],
		[
			{
				id: '55555555555555555555555555555555',
				title: 'binary.bin',
				mime: 'application/octet-stream',
			} as ResourceEntity,
			'[binary.bin](:/55555555555555555555555555555555)',
		],
		[
			{
				id: '66666666666666666666666666666666',
				title: 'unknown-type.dat',
				mime: '',
			} as ResourceEntity,
			'[unknown-type.dat](:/66666666666666666666666666666666)',
		],
	])('buildResourceMarkdownLink should return %s', (resource, expectedMarkdown) => {
		expect(buildResourceMarkdownLink(resource)).toBe(expectedMarkdown);
	});

	test('buildResourceMarkdownLink should return empty string without a resource id', () => {
		expect(buildResourceMarkdownLink({ title: 'photo.jpg' } as ResourceEntity)).toBe('');
	});

	test('deleteResourceLocally should remove decrypted local resource files', async () => {
		const resource = { id: 'resource-id', encryption_blob_encrypted: 0 } as ResourceEntity;
		jest.spyOn(Resource, 'load').mockResolvedValue(resource);
		jest.spyOn(Resource, 'localState').mockResolvedValue({ fetch_status: Resource.FETCH_STATUS_DONE });
		jest.spyOn(Resource, 'fullPath').mockImplementation((_resource, encrypted) => encrypted ? '/resource.crypted' : '/resource.txt');
		const setLocalState = jest.spyOn(Resource, 'setLocalState').mockResolvedValue();
		const markForDownload = jest.spyOn(Resource, 'markForDownload').mockResolvedValue();
		const exists = jest.fn().mockResolvedValue(true);
		const remove = jest.fn().mockResolvedValue(undefined);
		jest.spyOn(shim, 'fsDriver').mockReturnValue({ exists, remove } as unknown as ReturnType<typeof shim.fsDriver>);

		await deleteResourceLocally(resource.id);

		expect(setLocalState).toHaveBeenCalledWith(resource, {
			fetch_status: Resource.FETCH_STATUS_IDLE,
			fetch_error: '',
		});
		expect(markForDownload).toHaveBeenCalledWith(resource.id);
		expect(remove.mock.calls).toEqual([['/resource.txt'], ['/resource.crypted']]);
	});

	test('deleteResourceLocally should preserve a blob that is still encrypted', async () => {
		const resource = { id: 'resource-id', encryption_blob_encrypted: 1 } as ResourceEntity;
		jest.spyOn(Resource, 'load').mockResolvedValue(resource);
		jest.spyOn(Resource, 'localState').mockResolvedValue({ fetch_status: Resource.FETCH_STATUS_DONE });
		jest.spyOn(Resource, 'fullPath').mockImplementation((_resource, encrypted) => encrypted ? '/resource.crypted' : '/resource.txt');
		const setLocalState = jest.spyOn(Resource, 'setLocalState').mockResolvedValue();
		const markForDownload = jest.spyOn(Resource, 'markForDownload').mockResolvedValue();
		const remove = jest.fn().mockResolvedValue(undefined);
		jest.spyOn(shim, 'fsDriver').mockReturnValue({ exists: jest.fn().mockResolvedValue(true), remove } as unknown as ReturnType<typeof shim.fsDriver>);

		await expect(deleteResourceLocally(resource.id)).rejects.toThrow('downloaded or decrypted');
		expect(setLocalState).not.toHaveBeenCalled();
		expect(markForDownload).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
	});
});

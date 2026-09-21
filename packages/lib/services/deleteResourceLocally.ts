import { _ } from '../locale';
import Resource from '../models/Resource';
import shim from '../shim';

const deleteResourceLocally = async (resourceId: string) => {
	const resource = await Resource.load(resourceId);
	if (!resource) return;

	const localState = await Resource.localState(resource);
	const plainTextPath = Resource.fullPath(resource);
	const encryptedPath = Resource.fullPath(resource, true);
	const plainTextExists = await shim.fsDriver().exists(plainTextPath);
	if (resource.encryption_blob_encrypted || localState.fetch_status !== Resource.FETCH_STATUS_DONE || !plainTextExists) {
		throw new Error(_('This attachment cannot be deleted locally while it is being downloaded or decrypted.'));
	}

	await shim.fsDriver().remove(plainTextPath);
	if (await shim.fsDriver().exists(encryptedPath)) {
		await shim.fsDriver().remove(encryptedPath);
	}
	await Resource.setLocalState(resource, {
		fetch_status: Resource.FETCH_STATUS_IDLE,
		fetch_error: '',
	});
	await Resource.markForDownload(resource.id);
};

export default deleteResourceLocally;

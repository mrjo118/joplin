import * as React from 'react';
import { useContext } from 'react';
import { setupDatabaseAndSynchronizer, switchClient } from '@joplin/lib/testing/test-utils';
import { AppState } from '../../utils/types';
import { Store } from 'redux';
import createMockReduxStore from '../../utils/testing/createMockReduxStore';
import setupGlobalStore from '../../utils/testing/setupGlobalStore';
import PluginRunnerWebView from './PluginRunnerWebView';
import TestProviderStack from '../testing/TestProviderStack';
import { act, fireEvent, render, screen, waitFor } from '../../utils/testing/testingLibrary';
import createTestPlugin from '@joplin/lib/testing/plugins/createTestPlugin';
import getWebViewDomById from '../../utils/testing/getWebViewDomById';
import Setting from '@joplin/lib/models/Setting';
import PluginService from '@joplin/lib/services/plugins/PluginService';
import CommandService from '@joplin/lib/services/CommandService';
import DialogManager, { DialogContext, DialogControl } from '../DialogManager';
import PlatformImplementation from '../../services/plugins/PlatformImplementation';
import shim from '@joplin/lib/shim';
import makeShowMessageBox from '../../utils/makeShowMessageBox';
import { Platform } from 'react-native';

let store: Store<AppState>;

interface WrapperProps { }

let testDialogControl: DialogControl;
const CaptureDialogControl: React.FC = () => {
	testDialogControl = useContext(DialogContext);
	return null;
};

const WrappedPluginRunnerWebView: React.FC<WrapperProps> = _props => {
	return <TestProviderStack store={store}>
		<DialogManager themeId={Setting.THEME_LIGHT}>
			<PluginRunnerWebView/>
			<CaptureDialogControl/>
		</DialogManager>
	</TestProviderStack>;
};

const defaultManifestProperties = {
	manifest_version: 1,
	version: '0.1.0',
	app_min_version: '2.3.4',
	platforms: ['desktop', 'mobile'],
	name: 'Some plugin name',
};

type PluginSlice = { manifest: { id: string } };
const waitForPluginToLoad = (plugin: PluginSlice) => {
	return waitFor(async () => {
		expect(PluginService.instance().pluginById(plugin.manifest.id)).toBeTruthy();
	});
};

const webViewId = 'joplin__PluginDialogWebView';
const getUserWebViewDom = () => getWebViewDomById(webViewId);

describe('PluginRunnerWebView', () => {
	beforeEach(async () => {
		await setupDatabaseAndSynchronizer(0);
		await switchClient(0);

		store = createMockReduxStore();
		setupGlobalStore(store);
		Setting.setValue('plugins.pluginSupportEnabled', true);
	});

	test('should load a plugin that shows a dialog', async () => {
		const testPlugin = await createTestPlugin({
			...defaultManifestProperties,
			id: 'org.joplinapp.dialog-test',
		}, {
			onStart: `
				const dialogs = joplin.views.dialogs;
				const dialogHandle = await dialogs.create('test-dialog');
				await dialogs.setHtml(
					dialogHandle,
					'<h1>Test!</h1>',
				);
				await joplin.views.dialogs.open(dialogHandle)
			`,
		});
		render(<WrappedPluginRunnerWebView/>);
		await waitForPluginToLoad(testPlugin);

		// Should show the dialog
		await waitFor(async () => {
			const dom = await getUserWebViewDom();
			expect(dom.querySelector('h1').textContent).toBe('Test!');
		});
	});

	test('should load a plugin that adds a panel', async () => {
		const testPlugin = await createTestPlugin({
			...defaultManifestProperties,
			id: 'org.joplinapp.panel-test',
		}, {
			onStart: `
				const panels = joplin.views.panels;
				const handle = await panels.create('test-panel');
				await panels.setHtml(
					handle,
					'<h1>Panel content</h1><p>Test</p>',
				);

				const commands = joplin.commands;
				await commands.register({
					name: 'hideTestPanel',
					label: 'Hide the test plugin panel',
					execute: async () => {
						await panels.hide(handle);
					},
				});

				await commands.register({
					name: 'showTestPanel',
					execute: async () => {
						await panels.show(handle);
					},
				});
			`,
		});
		render(<WrappedPluginRunnerWebView/>);
		await waitForPluginToLoad(testPlugin);

		act(() => {
			store.dispatch({ type: 'SET_PLUGIN_PANELS_DIALOG_VISIBLE', visible: true });
		});

		const expectPanelVisible = async () => {
			const dom = await getUserWebViewDom();
			await waitFor(async () => {
				expect(dom.querySelector('h1').textContent).toBe('Panel content');
			});
		};
		await expectPanelVisible();

		// Should hide the panel
		await act(() => CommandService.instance().execute('hideTestPanel'));
		await waitFor(() => {
			expect(screen.queryByTestId('webViewId')).toBeNull();
		});

		// Should show the panel again
		await act(() => CommandService.instance().execute('showTestPanel'));
		await expectPanelVisible();
	});

	test('should show an interactive plugin dialog above an open plugin panel', async () => {
		const platformOs = jest.replaceProperty(Platform, 'OS', 'android');
		const testPlugin = await createTestPlugin({
			...defaultManifestProperties,
			id: 'org.joplinapp.panel-dialog-test',
		}, {
			onStart: `
				const panels = joplin.views.panels;
				const panelHandle = await panels.create('test-panel');
				await panels.setHtml(panelHandle, '<h1>Panel content</h1>');

				await joplin.commands.register({
					name: 'openDialogFromPanel',
					label: 'Open dialog',
					execute: async () => {
						const dialogHandle = await joplin.views.dialogs.create('panel-child-dialog');
						await joplin.views.dialogs.setHtml(dialogHandle, '<h2>Child dialog</h2>');
						await joplin.views.dialogs.open(dialogHandle);
					},
				});
			`,
		});
		const rendered = render(<WrappedPluginRunnerWebView/>);
		await waitForPluginToLoad(testPlugin);

		act(() => {
			store.dispatch({ type: 'SET_PLUGIN_PANELS_DIALOG_VISIBLE', visible: true });
		});
		const panel = await screen.findByTestId('plugin-panel-modal');
		await waitFor(() => {
			expect(CommandService.instance().commandByName('openDialogFromPanel', { mustExist: false })).toBeTruthy();
		});

		const openDialog = CommandService.instance().execute('openDialogFromPanel');
		const dialog = await screen.findByTestId('plugin-dialog-modal');
		expect(dialog).toBeVisible();
		expect(panel.props.accessibilityElementsHidden).toBe(true);
		expect(panel.props.pointerEvents).toBe('none');

		// The panel and its child dialog share the Paper portal host. Portal
		// children later in the tree are topmost and receive pointer events.
		type TestInstance = typeof rendered.UNSAFE_root;
		const modalOrder = rendered.UNSAFE_root.findAll((node: TestInstance) => (
			node.props.testID === 'plugin-panel-modal' || node.props.testID === 'plugin-dialog-modal'
		)).map((node: TestInstance) => node.props.testID);
		expect(modalOrder.indexOf('plugin-dialog-modal')).toBeGreaterThan(modalOrder.lastIndexOf('plugin-panel-modal'));

		// Verify that the topmost dialog is interactive and that closing it
		// reveals (and returns interaction to) the still-mounted panel.
		fireEvent.press(await screen.findByText('Cancel'));
		await act(() => openDialog);
		await waitFor(() => expect(screen.queryByTestId('plugin-dialog-modal')).toBeNull());
		expect(panel).toBeVisible();
		expect(panel.props.accessibilityElementsHidden).toBe(false);

		// This is the mobile platform implementation called by
		// joplin.views.dialogs.showMessageBox in the plugin sandbox.
		expect(testDialogControl).toBeTruthy();
		const promptSpy = jest.spyOn(testDialogControl, 'prompt');
		shim.showMessageBox = makeShowMessageBox({ current: testDialogControl });
		let showMessageBox: Promise<number>;
		act(() => {
			showMessageBox = PlatformImplementation.instance().joplin.views.dialogs.showMessageBox('Child message box');
		});
		expect(promptSpy).toHaveBeenCalled();
		const messageBox = await screen.findByTestId('message-box-modal');
		expect(messageBox).toBeVisible();
		expect(await screen.findByText('Child message box')).toBeVisible();

		// Message boxes use a native Modal, which Android presents in a window
		// above the panel's contained portal.
		fireEvent.press(await screen.findByText('OK'));
		await act(() => showMessageBox);
		await waitFor(() => expect(screen.queryByText('Child message box')).toBeNull());
		expect(panel).toBeVisible();
		platformOs.restore();
	});
});

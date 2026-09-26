import * as React from 'react';
import { ReactElement } from 'react';
import { PluginHtmlContents, PluginStates, ViewInfo } from '@joplin/lib/services/plugins/reducer';
import PluginDialogWebView from './PluginDialogWebView';
import Modal from '../../Modal';
import PluginService from '@joplin/lib/services/plugins/PluginService';
import WebviewController, { ContainerType } from '@joplin/lib/services/plugins/WebviewController';
import useViewInfos from './hooks/useViewInfos';
import PluginPanelViewer from './PluginPanelViewer';
import { StyleSheet } from 'react-native';
import { themeStyle } from '@joplin/lib/theme';

const styles = StyleSheet.create({
	modalBackground: {
		alignItems: 'center',
		justifyContent: 'center',
	},
});

interface Props {
	themeId: number;

	pluginHtmlContents: PluginHtmlContents;
	pluginStates: PluginStates;
}

const dismissDialog = (viewInfo: ViewInfo) => {
	if (!viewInfo.view.opened) return;

	const plugin = PluginService.instance().pluginById(viewInfo.plugin.id);
	const viewController = plugin.viewController(viewInfo.view.id) as WebviewController;
	viewController.closeWithResponse(null);
};

const PluginDialogManager: React.FC<Props> = props => {
	const viewInfos = useViewInfos(props.pluginStates);
	const theme = themeStyle(props.themeId);

	const dialogs: ReactElement[] = [];
	for (const viewInfo of viewInfos) {
		if (viewInfo.view.containerType !== ContainerType.Dialog || !viewInfo.view.opened) {
			continue;
		}

		dialogs.push(
			<Modal
				key={`${viewInfo.plugin.id}-${viewInfo.view.id}`}
				visible={true}
				onClose={() => dismissDialog(viewInfo)}
				modalBackgroundStyle={styles.modalBackground}
				backgroundColor={theme.backgroundColorTransparent2}
			>
				<PluginDialogWebView
					viewInfo={viewInfo}
					themeId={props.themeId}
					pluginStates={props.pluginStates}
					pluginHtmlContents={props.pluginHtmlContents}
				/>
			</Modal>,
		);
	}

	return (
		<>
			<PluginPanelViewer/>
			{dialogs}
		</>
	);
};

export default PluginDialogManager;

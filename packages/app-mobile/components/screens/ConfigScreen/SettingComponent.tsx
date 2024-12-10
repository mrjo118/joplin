import * as React from 'react';

import { UpdateSettingValueCallback } from './types';
import { View, Text, TextInput } from 'react-native';
import Setting, { AppType } from '@joplin/lib/models/Setting';
import Dropdown from '../../Dropdown';
import { ConfigScreenStyles } from './configScreenStyles';
import SettingsToggle from './SettingsToggle';
import FileSystemPathSelector from './FileSystemPathSelector';
import shim from '@joplin/lib/shim';
import { themeStyle } from '../../global-style';
import { useId, useState } from 'react';

interface Props {
	settingId: string;

	// The value associated with the given settings key
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Old code before rule was applied
	value: any;

	styles: ConfigScreenStyles;
	themeId: number;

	updateSettingValue: UpdateSettingValueCallback;
}


const SettingComponent: React.FunctionComponent<Props> = props => {
	const themeId = props.themeId;
	const theme = themeStyle(themeId);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Old code before rule was applied
	const output: any = null;

	const md = Setting.settingMetadata(props.settingId);
	const settingDescription = md.description ? md.description(AppType.Mobile) : '';

	const styleSheet = props.styles.styleSheet;

	const descriptionComp = !settingDescription ? null : <Text style={styleSheet.settingDescriptionText}>{settingDescription}</Text>;
	const containerStyle = props.styles.getContainerStyle(!!settingDescription);

	const labelId = useId();
	const [valueState, setValueState] = useState(props.value?.toString());

	if (md.isEnum) {
		const value = props.value?.toString();

		const items = Setting.enumOptionsToValueLabels(md.options(), md.optionsOrder ? md.optionsOrder() : []);
		const label = md.label();

		return (
			<View key={props.settingId} style={{ flexDirection: 'column', borderBottomWidth: 1, borderBottomColor: theme.dividerColor }}>
				<View style={containerStyle}>
					<Text key="label" style={styleSheet.settingText}>
						{label}
					</Text>
					<Dropdown
						key="control"
						// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Old code before rule was applied
						items={items as any}
						selectedValue={value}
						itemListStyle={{
							backgroundColor: theme.backgroundColor,
						}}
						headerStyle={{
							color: theme.color,
							fontSize: theme.fontSize,
						}}
						itemStyle={{
							color: theme.color,
							fontSize: theme.fontSize,
						}}
						onValueChange={(itemValue: string) => {
							void props.updateSettingValue(props.settingId, itemValue);
						}}
						accessibilityHint={label}
					/>
				</View>
				{descriptionComp}
			</View>
		);
	} else if (md.type === Setting.TYPE_BOOL) {
		return (
			<SettingsToggle
				settingId={props.settingId}
				value={props.value}
				themeId={props.themeId}
				styles={props.styles}
				label={md.label()}
				updateSettingValue={props.updateSettingValue}
				description={descriptionComp}
			/>
		);
	} else if (md.type === Setting.TYPE_INT) {
		const label = md.unitLabel?.toString() !== undefined ? `${md.label()} (${md.unitLabel(md.value)})` : `${md.label()}`;

		return (
			<View key={props.settingId} style={{ flexDirection: 'column', borderBottomWidth: 1, borderBottomColor: theme.dividerColor }}>
				<View key={props.settingId} style={containerStyle}>
					<Text key="label" style={styleSheet.settingText}>
						{label}
					</Text>
					<TextInput
						keyboardType="numeric"
						autoCorrect={false}
						autoComplete="off"
						selectionColor={theme.textSelectionColor}
						keyboardAppearance={theme.keyboardAppearance}
						autoCapitalize="none"
						key="control"
						style={styleSheet.settingControl}
						value={valueState}
						onChangeText={newValue => {
							setValueState(newValue);
							void props.updateSettingValue(props.settingId, Number.isInteger(Number(newValue)) ? newValue : ''); // Prevent invalid values being mapped to 0
						}}
						maxLength={15}
						secureTextEntry={!!md.secure}
					/>
				</View>
				{descriptionComp}
			</View>
		);
	} else if (md.type === Setting.TYPE_STRING) {
		if (['sync.2.path', 'plugins.devPluginPaths'].includes(md.key) && (shim.fsDriver().isUsingAndroidSAF() || shim.mobilePlatform() === 'web')) {
			return (
				<FileSystemPathSelector
					mode={md.key === 'sync.2.path' ? 'readwrite' : 'read'}
					styles={props.styles}
					settingMetadata={md}
					updateSettingValue={props.updateSettingValue}
				/>
			);
		}

		return (
			<View key={props.settingId} style={{ flexDirection: 'column', borderBottomWidth: 1, borderBottomColor: theme.dividerColor }}>
				<View key={props.settingId} style={containerStyle}>
					<Text key="label" style={styleSheet.settingText} nativeID={labelId}>
						{md.label()}
					</Text>
					<TextInput
						autoCorrect={false}
						autoComplete="off"
						selectionColor={theme.textSelectionColor}
						keyboardAppearance={theme.keyboardAppearance}
						autoCapitalize="none"
						key="control"
						style={styleSheet.settingControl}
						value={props.value}
						onChangeText={(newValue: string) => void props.updateSettingValue(props.settingId, newValue)}
						secureTextEntry={!!md.secure}
						aria-labelledby={labelId}
					/>
				</View>
				{descriptionComp}
			</View>
		);
	} else if (md.type === Setting.TYPE_BUTTON) {
		// TODO: Not yet supported
	} else if (Setting.value('env') === 'dev') {
		throw new Error(`Unsupported setting type: ${md.type}`);
	}

	return output;
};

export default SettingComponent;

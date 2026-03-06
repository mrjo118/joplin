import * as React from 'react';
import { memo, useCallback, useMemo } from 'react';
import { connect } from 'react-redux';
import { Text, StyleSheet, TextStyle, ViewStyle, AccessibilityInfo, Pressable } from 'react-native';
import Checkbox from './Checkbox';
import Note from '@joplin/lib/models/Note';
import time from '@joplin/lib/time';
import { themeStyle } from './global-style';
import { _ } from '@joplin/lib/locale';
import { AppState } from '../utils/types';
import { Dispatch } from 'redux';
import { NoteEntity } from '@joplin/lib/services/database/types';
import useOnLongPressProps from '../utils/hooks/useOnLongPressProps';
import MultiTouchableOpacity from './buttons/MultiTouchableOpacity';
import Icon from './Icon';

export interface NoteItemProps {
	dispatch: Dispatch;
	themeId: number;
	note: NoteEntity;
	noteSelectionEnabled: boolean;
	selectedNoteIds: string[];
	noteIndex?: number;
	totalNotes?: number;
	notes?: NoteEntity[];
	noteReorderModeEnabled?: boolean;
	uncompletedTodosOnTop?: boolean;
	showCompletedTodos?: boolean;
	folderId?: string;
	onDragStart?: ()=> void;
	onDragEnd?: ()=> void;
	isActive?: boolean;
}

type Props = NoteItemProps;


const useStyles = (themeId: number, noteReorderModeEnabled: boolean) => {
	return useMemo(() => {
		const theme = themeStyle(themeId);

		const listItem: ViewStyle = {
			flexDirection: 'row',
			borderBottomWidth: 1,
			borderBottomColor: theme.dividerColor,
			alignItems: 'flex-start',
			backgroundColor: theme.backgroundColor,
		};

		const listItemPressable: ViewStyle = {
			flexGrow: 1,
			flexShrink: 1,
			alignSelf: 'stretch',
		};
		const listItemPressableWithCheckbox: ViewStyle = {
			...listItemPressable,
			paddingRight: noteReorderModeEnabled ? 0 : theme.marginRight,
		};
		const listItemPressableWithoutCheckbox: ViewStyle = {
			...listItemPressable,
			paddingLeft: noteReorderModeEnabled ? 0 : theme.marginLeft,
			paddingRight: noteReorderModeEnabled ? theme.marginRight : theme.marginRight,
			paddingTop: theme.itemMarginTop,
			paddingBottom: theme.itemMarginBottom,
		};

		const listItemText: TextStyle = {
			flex: 1,
			color: theme.color,
			fontSize: theme.fontSize,
		};

		const listItemTextWithCheckbox = { ...listItemText };
		listItemTextWithCheckbox.marginTop = theme.itemMarginTop - 1;
		listItemTextWithCheckbox.marginBottom = listItem.paddingBottom;

		const selectionWrapper: ViewStyle = { };

		const selectionWrapperSelected = { ...selectionWrapper };
		selectionWrapperSelected.backgroundColor = theme.selectedColor;

		const dragHandleContainer: ViewStyle = {
			justifyContent: 'center',
			alignItems: 'center',
			alignSelf: 'stretch',
			paddingHorizontal: 12,
		};

		const dragHandleIcon: TextStyle = {
			fontSize: 20,
			color: theme.color,
			opacity: 0.6,
		};

		return StyleSheet.create({
			listItem,
			listItemText,
			selectionWrapper,
			listItemPressableWithoutCheckbox,
			listItemPressableWithCheckbox,
			listItemTextWithCheckbox,
			selectionWrapperSelected,
			checkboxStyle: {
				color: theme.color,
				paddingRight: 10,
				paddingTop: theme.itemMarginTop,
				paddingBottom: theme.itemMarginBottom,
				paddingLeft: noteReorderModeEnabled ? 0 : theme.marginLeft,
			},
			checkedOpacityStyle: {
				opacity: 0.4,
			},
			uncheckedOpacityStyle: { },
			dragHandleContainer,
			dragHandleIcon,
		});
	}, [themeId, noteReorderModeEnabled]);
};

const NoteItemComponent: React.FC<Props> = memo(props => {
	const noteReorderModeEnabled = props.noteReorderModeEnabled ?? false;
	const styles = useStyles(props.themeId, noteReorderModeEnabled);

	const todoCheckbox_change = useCallback(async (checked: boolean) => {
		if (!props.note) return;

		const newNote = {
			id: props.note.id,
			todo_completed: checked ? time.unixMs() : 0,
		};
		await Note.save(newNote);

		props.dispatch({ type: 'NOTE_SORT' });
	}, [props.note, props.dispatch]);

	const onPress = useCallback(() => {
		if (!props.note) return;
		if (props.note.encryption_applied) return;

		// In reorder mode, don't navigate to the note
		if (noteReorderModeEnabled) return;

		if (props.noteSelectionEnabled) {
			props.dispatch({
				type: 'NOTE_SELECTION_TOGGLE',
				id: props.note.id,
			});
		} else {
			props.dispatch({
				type: 'NAV_GO',
				routeName: 'Note',
				noteId: props.note.id,
			});
		}
	}, [props.note, props.noteSelectionEnabled, props.dispatch, noteReorderModeEnabled]);

	const onLongPress = useCallback(() => {
		if (!props.note) return;

		// In reorder mode, don't trigger selection on long press (drag is handled by the handle)
		if (noteReorderModeEnabled) {
			return;
		}

		if (!props.noteSelectionEnabled) {
			AccessibilityInfo.announceForAccessibility(_('Entering selection mode'));
		}

		props.dispatch({
			type: props.noteSelectionEnabled ? 'NOTE_SELECTION_TOGGLE' : 'NOTE_SELECTION_START',
			id: props.note.id,
		});
	}, [props.dispatch, props.note, props.noteSelectionEnabled, noteReorderModeEnabled]);

	// Determine if this note is a todo
	const note = props.note ?? {};
	const isTodo = !!Number(note.is_todo);

	const checkboxChecked = !!Number(note.todo_completed);

	const checkboxStyle = styles.checkboxStyle;
	const listItemTextStyle = isTodo ? styles.listItemTextWithCheckbox : styles.listItemText;
	const opacityStyle = isTodo && checkboxChecked ? styles.checkedOpacityStyle : styles.uncheckedOpacityStyle;
	const isSelected = props.noteSelectionEnabled && props.selectedNoteIds.includes(note.id);

	const selectionWrapperStyle = isSelected ? styles.selectionWrapperSelected : styles.selectionWrapper;

	const noteTitle = Note.displayTitle(note);
	const selectDeselectLabel = isSelected ? _('Deselect') : _('Select');
	const onLongPressProps = useOnLongPressProps({ onLongPress, actionDescription: selectDeselectLabel });

	const todoCheckbox = isTodo ? <Checkbox
		style={checkboxStyle}
		checked={checkboxChecked}
		onChange={todoCheckbox_change}
		accessibilityLabel={_('to-do: %s', noteTitle)}
	/> : null;

	// Render drag handle when in reorder mode - long pressing it starts the drag
	const dragHandle = noteReorderModeEnabled ? (
		<Pressable
			onLongPress={props.onDragStart}
			onPressOut={props.onDragEnd}
			delayLongPress={200}
			style={styles.dragHandleContainer}
			accessibilityLabel={_('Long press to drag and reorder')}
			accessibilityRole="button"
		>
			<Icon name="ionicon reorder-two" style={styles.dragHandleIcon} accessibilityLabel={null} />
		</Pressable>
	) : null;

	const pressableProps = {
		style: isTodo ? styles.listItemPressableWithCheckbox : styles.listItemPressableWithoutCheckbox,
		accessibilityHint: props.noteSelectionEnabled ? '' : noteReorderModeEnabled ? '' : _('Opens note'),
		'aria-pressed': props.noteSelectionEnabled ? isSelected : undefined,
		accessibilityState: { selected: isSelected },
		...onLongPressProps,
	};

	// Text style with overflow handling for reorder mode
	const textStyle = noteReorderModeEnabled ? [listItemTextStyle, { overflow: 'hidden' as const }] : listItemTextStyle;

	// Combine drag handle with checkbox for the left side content
	const leftContent = noteReorderModeEnabled ? (
		<>
			{dragHandle}
			{todoCheckbox}
		</>
	) : todoCheckbox;

	// Add active state styling when being dragged - same appearance but elevated
	const activeStyle = props.isActive ? { elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 } : {};

	return (
		<MultiTouchableOpacity
			{...pressableProps}
			containerProps={{
				style: [selectionWrapperStyle, opacityStyle, styles.listItem, activeStyle],
			}}
			onPress={onPress}
			beforePressable={leftContent}
		>
			<Text style={textStyle} numberOfLines={noteReorderModeEnabled ? 1 : undefined}>{noteTitle}</Text>
		</MultiTouchableOpacity>
	);
});

export default connect((state: AppState) => {
	return {
		themeId: state.settings.theme,
		noteSelectionEnabled: state.noteSelectionEnabled,
		selectedNoteIds: state.selectedNoteIds,
	};
})(NoteItemComponent);


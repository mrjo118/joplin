import * as React from 'react';
import { memo, useCallback, useMemo } from 'react';
import { connect } from 'react-redux';
import { Text, StyleSheet, TextStyle, ViewStyle, AccessibilityInfo, View, TouchableOpacity } from 'react-native';
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

interface Props {
	dispatch: Dispatch;
	themeId: number;
	note: NoteEntity;
	noteSelectionEnabled: boolean;
	selectedNoteIds: string[];
	// Props for reorder mode
	noteIndex?: number;
	totalNotes?: number;
	notes?: NoteEntity[];
	noteReorderModeEnabled?: boolean;
	uncompletedTodosOnTop?: boolean;
	showCompletedTodos?: boolean;
	folderId?: string;
	scrollIntoView?: (index: number)=> void;
}


const useStyles = (themeId: number, noteReorderModeEnabled: boolean) => {
	return useMemo(() => {
		const theme = themeStyle(themeId);

		const listItem: ViewStyle = {
			flexDirection: 'row',
			// height: 40,
			borderBottomWidth: 1,
			borderBottomColor: theme.dividerColor,
			alignItems: 'flex-start',
			// backgroundColor: theme.backgroundColor,
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
			paddingLeft: theme.marginLeft,
			paddingRight: noteReorderModeEnabled ? 0 : theme.marginRight,
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

		const reorderButtonsContainer: ViewStyle = {
			flexDirection: 'row',
			alignItems: 'center',
			alignSelf: 'stretch',
			backgroundColor: theme.backgroundColor,
			paddingRight: theme.marginRight,
		};

		const reorderButton: ViewStyle = {
			padding: 8,
			justifyContent: 'center',
			alignItems: 'center',
		};

		const reorderButtonDisabled: ViewStyle = {
			...reorderButton,
			opacity: theme.disabledOpacity,
		};

		const reorderIcon: TextStyle = {
			fontSize: 22,
			color: theme.color,
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
				paddingLeft: theme.marginLeft,
			},
			checkedOpacityStyle: {
				opacity: 0.4,
			},
			uncheckedOpacityStyle: { },
			reorderButtonsContainer,
			reorderButton,
			reorderButtonDisabled,
			reorderIcon,
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
		// Disable long press in reorder mode
		if (noteReorderModeEnabled) return;

		if (!props.noteSelectionEnabled) {
			AccessibilityInfo.announceForAccessibility(_('Entering selection mode'));
		}

		props.dispatch({
			type: props.noteSelectionEnabled ? 'NOTE_SELECTION_TOGGLE' : 'NOTE_SELECTION_START',
			id: props.note.id,
		});
	}, [props.dispatch, props.note, props.noteSelectionEnabled, noteReorderModeEnabled]);

	// Determine if this note is an uncompleted todo
	const note = props.note ?? {};
	const isTodo = !!Number(note.is_todo);
	const isUncompletedTodo = isTodo && !Number(note.todo_completed);

	// Calculate boundary conditions for reorder buttons
	const canMoveUp = useMemo(() => {
		if (!noteReorderModeEnabled) return false;
		const noteIndex = props.noteIndex ?? 0;
		if (noteIndex === 0) return false;

		// If uncompletedTodosOnTop is enabled, check if moving would cross the boundary
		if (props.uncompletedTodosOnTop && props.notes) {
			const prevNote = props.notes[noteIndex - 1];
			const prevIsUncompletedTodo = !!prevNote?.is_todo && !prevNote?.todo_completed;

			// If current note is NOT an uncompleted todo and the previous note IS an uncompleted todo,
			// then we cannot move up (would cross the boundary)
			if (!isUncompletedTodo && prevIsUncompletedTodo) {
				return false;
			}
		}

		return true;
	}, [noteReorderModeEnabled, props.noteIndex, props.uncompletedTodosOnTop, props.notes, isUncompletedTodo]);

	const canMoveDown = useMemo(() => {
		if (!noteReorderModeEnabled) return false;
		const noteIndex = props.noteIndex ?? 0;
		const totalNotes = props.totalNotes ?? 0;
		if (noteIndex >= totalNotes - 1) return false;

		// If uncompletedTodosOnTop is enabled, check if moving would cross the boundary
		if (props.uncompletedTodosOnTop && props.notes) {
			const nextNote = props.notes[noteIndex + 1];
			const nextIsUncompletedTodo = !!nextNote?.is_todo && !nextNote?.todo_completed;

			// If current note IS an uncompleted todo and the next note is NOT an uncompleted todo,
			// then we cannot move down (would cross the boundary)
			if (isUncompletedTodo && !nextIsUncompletedTodo) {
				return false;
			}
		}

		return true;
	}, [noteReorderModeEnabled, props.noteIndex, props.totalNotes, props.uncompletedTodosOnTop, props.notes, isUncompletedTodo]);

	const handleMoveUp = useCallback(() => {
		if (!canMoveUp || !props.folderId || !props.note?.id) return;
		const noteIndex = props.noteIndex ?? 0;
		const targetIndex = noteIndex - 1;

		props.dispatch({
			type: 'NOTE_REORDER_LOCAL',
			noteId: props.note.id,
			fromIndex: noteIndex,
			toIndex: targetIndex,
		});

		void Note.insertNotesAt(
			props.folderId,
			[props.note.id],
			targetIndex,
			props.uncompletedTodosOnTop ?? false,
			props.showCompletedTodos ?? true,
		);

		props.scrollIntoView?.(targetIndex);
	}, [canMoveUp, props.folderId, props.note?.id, props.noteIndex, props.uncompletedTodosOnTop, props.showCompletedTodos, props.dispatch, props.scrollIntoView]);

	const handleMoveDown = useCallback(() => {
		if (!canMoveDown || !props.folderId || !props.note?.id) return;
		const noteIndex = props.noteIndex ?? 0;
		// When moving down, the target index for insertNotesAt needs to be +2
		// because insertNotesAt inserts BEFORE the target index
		const targetIndex = noteIndex + 2;

		props.dispatch({
			type: 'NOTE_REORDER_LOCAL',
			noteId: props.note.id,
			fromIndex: noteIndex,
			toIndex: noteIndex + 1,
		});

		void Note.insertNotesAt(
			props.folderId,
			[props.note.id],
			targetIndex,
			props.uncompletedTodosOnTop ?? false,
			props.showCompletedTodos ?? true,
		);

		props.scrollIntoView?.(targetIndex);
	}, [canMoveDown, props.folderId, props.note?.id, props.noteIndex, props.uncompletedTodosOnTop, props.showCompletedTodos, props.dispatch, props.scrollIntoView]);

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

	// Render reorder buttons when in reorder mode
	const reorderButtons = noteReorderModeEnabled ? (
		<View style={styles.reorderButtonsContainer}>
			<TouchableOpacity
				onPress={handleMoveUp}
				disabled={!canMoveUp}
				style={canMoveUp ? styles.reorderButton : styles.reorderButtonDisabled}
				accessibilityLabel={_('Move up')}
				accessibilityRole="button"
				accessibilityState={{ disabled: !canMoveUp }}
			>
				<Icon name="ionicon chevron-up" style={styles.reorderIcon} accessibilityLabel={null} />
			</TouchableOpacity>
			<TouchableOpacity
				onPress={handleMoveDown}
				disabled={!canMoveDown}
				style={canMoveDown ? styles.reorderButton : styles.reorderButtonDisabled}
				accessibilityLabel={_('Move down')}
				accessibilityRole="button"
				accessibilityState={{ disabled: !canMoveDown }}
			>
				<Icon name="ionicon chevron-down" style={styles.reorderIcon} accessibilityLabel={null} />
			</TouchableOpacity>
		</View>
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

	return (
		<MultiTouchableOpacity
			{...pressableProps}
			containerProps={{
				style: [selectionWrapperStyle, opacityStyle, styles.listItem],
			}}
			onPress={onPress}
			beforePressable={todoCheckbox}
			afterPressable={reorderButtons}
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


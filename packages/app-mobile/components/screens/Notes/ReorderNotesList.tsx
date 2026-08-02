import * as React from 'react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Sortable, SortableItem, SortableRenderItemProps } from 'react-native-reanimated-dnd';
import Note from '@joplin/lib/models/Note';
import Icon from '../../Icon';
import { NoteEntity } from '@joplin/lib/services/database/types';
import { themeStyle } from '../../global-style';
import { State as ShareServiceState } from '@joplin/lib/services/share/reducer';
import { itemIsReadOnlySync, ItemSlice } from '@joplin/lib/models/utils/readOnly';
import { ModelType } from '@joplin/lib/BaseModel';
import ItemChange from '@joplin/lib/models/ItemChange';

interface Props {
	themeId: number;
	notes: NoteEntity[];
	selectedFolderId: string;
	uncompletedTodosOnTop: boolean;
	showCompletedTodos: boolean;
	shareService: ShareServiceState;
	syncUserId: string;
}

type SortableNote = NoteEntity & { id: string };

const isUncompletedTodo = (note: NoteEntity) => !!note.is_todo && !note.todo_completed;

const useStyles = (themeId: number) => {
	return useMemo(() => {
		const theme = themeStyle(themeId);

		const row: ViewStyle = {
			flexDirection: 'row',
			alignItems: 'center',
			paddingLeft: 0,
			paddingTop: theme.marginTop,
			paddingBottom: theme.marginBottom,
			position: 'relative',
		};

		const titleText: TextStyle = {
			flexShrink: 1,
			color: theme.color,
			fontSize: theme.fontSize,
		};

		return StyleSheet.create({
			rowContainer: {
				overflow: 'hidden',
				borderTopWidth: 1,
				borderTopColor: theme.dividerColor,
				borderBottomWidth: 1,
				borderBottomColor: theme.dividerColor,
				marginLeft: theme.marginLeft,
				marginRight: theme.marginRight,
			},
			row,
			rowMainContent: {
				flex: 1,
				overflow: 'hidden',
				paddingLeft: theme.marginLeft,
				paddingRight: 0,
			},
			todoIcon: {
				color: theme.color,
				fontSize: 20,
				height: 22,
				paddingRight: 10,
			},
			titleWrapper: {
				flex: 1,
				justifyContent: 'center',
				paddingRight: 0,
			},
			titleText,
			handleCell: {
				width: 56,
				justifyContent: 'center',
				alignItems: 'center',
				backgroundColor: 'transparent',
			},
			handleContainer: {
				width: '100%',
				height: '100%',
				justifyContent: 'center',
				alignItems: 'center',
			},
			handleTouchArea: {
				width: '100%',
				height: '100%',
				justifyContent: 'center',
				alignItems: 'center',
			},
			handleIcon: {
				color: theme.color,
				fontSize: 24,
			},
		});
	}, [themeId]);
};

interface ReorderRowProps {
	themeId: number;
	note: SortableNote;
	itemProps: Omit<SortableRenderItemProps<SortableNote>, 'item'>;
	onDrop: (id: string, targetIndex: number)=> Promise<void>;
}

const ReorderRow: React.FC<ReorderRowProps> = memo(({ themeId, note, itemProps, onDrop }) => {
	const styles = useStyles(themeId);
	const isTodo = !!note.is_todo;
	const checkboxChecked = !!note.todo_completed;
	const checkboxIconName = checkboxChecked ? 'ionicon checkbox-outline' : 'ionicon square-outline';
	const noteTitle = Note.displayTitle(note);

	return (
		<SortableItem
			id={itemProps.id}
			data={note}
			positions={itemProps.positions}
			itemsCount={itemProps.itemsCount}
			lowerBound={itemProps.lowerBound}
			autoScrollDirection={itemProps.autoScrollDirection}
			isDynamicHeight={itemProps.isDynamicHeight}
			estimatedItemHeight={itemProps.estimatedItemHeight}
			itemHeights={itemProps.itemHeights}
			scheduleHeightUpdate={itemProps.scheduleHeightUpdate}
			onDrop={onDrop}
		>
			<View style={styles.rowContainer}>
				<View style={styles.row}>
					<View style={styles.rowMainContent}>
						{isTodo ? <Icon name={checkboxIconName} style={styles.todoIcon} accessibilityLabel={null} /> : null}
						<View style={styles.titleWrapper}>
							<Text numberOfLines={1} ellipsizeMode='tail' style={styles.titleText}>{noteTitle}</Text>
						</View>
					</View>
					<View style={styles.handleCell}>
						<SortableItem.Handle style={styles.handleContainer}>
							<View style={styles.handleTouchArea}>
								<Icon name='ionicon reorder-three-outline' style={styles.handleIcon} accessibilityLabel={null} />
							</View>
						</SortableItem.Handle>
					</View>
				</View>
			</View>
		</SortableItem>
	);
});

const ReorderNotesList: React.FC<Props> = ({
	themeId,
	notes,
	selectedFolderId,
	uncompletedTodosOnTop,
	showCompletedTodos,
	shareService,
	syncUserId,
}) => {
	const [resetCounter, setResetCounter] = useState(0);
	const isSavingRef = useRef(false);
	const sortableNotes = useMemo(() => notes.filter(note => !!note.id) as SortableNote[], [notes]);

	const noteSignature = useMemo(() => {
		return sortableNotes.map(note => `${note.id}:${note.order}:${note.todo_completed}`).join('|');
	}, [sortableNotes]);

	const isDropValid = useCallback((draggedNoteId: string, targetIndex: number) => {
		if (targetIndex < 0 || targetIndex >= sortableNotes.length) return false;
		if (!uncompletedTodosOnTop) return true;

		const draggedNote = sortableNotes.find(note => note.id === draggedNoteId);
		if (!draggedNote) return false;

		const draggedGroup = isUncompletedTodo(draggedNote);
		let firstGroupIndex = -1;
		let lastGroupIndex = -1;

		for (let i = 0; i < sortableNotes.length; i++) {
			if (isUncompletedTodo(sortableNotes[i]) !== draggedGroup) continue;
			if (firstGroupIndex < 0) firstGroupIndex = i;
			lastGroupIndex = i;
		}

		if (firstGroupIndex < 0 || lastGroupIndex < 0) return false;
		return targetIndex >= firstGroupIndex && targetIndex <= lastGroupIndex;
	}, [sortableNotes, uncompletedTodosOnTop]);

	const onDrop = useCallback(async (draggedNoteId: string, targetIndex: number) => {
		if (isSavingRef.current) {
			setResetCounter(counter => counter + 1);
			return;
		}

		const currentIndex = sortableNotes.findIndex(note => note.id === draggedNoteId);
		if (currentIndex < 0) {
			setResetCounter(counter => counter + 1);
			return;
		}

		let draggedNote: NoteEntity = sortableNotes[currentIndex];
		if (!Object.prototype.hasOwnProperty.call(draggedNote, 'share_id')) {
			draggedNote = await Note.load(draggedNoteId, { fields: ['id', 'share_id', 'deleted_time'] });
		}

		if (draggedNote && itemIsReadOnlySync(
			ModelType.Note,
			ItemChange.SOURCE_UNSPECIFIED,
			draggedNote as ItemSlice,
			syncUserId,
			shareService,
			true,
		)) {
			setResetCounter(counter => counter + 1);
			return;
		}

		const boundedTargetIndex = Math.max(0, Math.min(targetIndex, sortableNotes.length - 1));
		if (currentIndex === boundedTargetIndex) return;

		if (!isDropValid(draggedNoteId, boundedTargetIndex)) {
			setResetCounter(counter => counter + 1);
			return;
		}

		isSavingRef.current = true;
		try {
			await Note.insertNotesAt(selectedFolderId, [draggedNoteId], boundedTargetIndex, uncompletedTodosOnTop, showCompletedTodos);
		} catch {
			setResetCounter(counter => counter + 1);
		} finally {
			isSavingRef.current = false;
		}
	}, [sortableNotes, selectedFolderId, uncompletedTodosOnTop, showCompletedTodos, isDropValid, syncUserId, shareService]);

	const renderItem = useCallback((itemProps: SortableRenderItemProps<SortableNote>) => {
		return <ReorderRow
			themeId={themeId}
			note={itemProps.item}
			itemProps={{
				index: itemProps.index,
				id: itemProps.id,
				positions: itemProps.positions,
				direction: itemProps.direction,
				lowerBound: itemProps.lowerBound,
				autoScrollDirection: itemProps.autoScrollDirection,
				autoScrollHorizontalDirection: itemProps.autoScrollHorizontalDirection,
				itemsCount: itemProps.itemsCount,
				itemHeight: itemProps.itemHeight,
				itemWidth: itemProps.itemWidth,
				gap: itemProps.gap,
				paddingHorizontal: itemProps.paddingHorizontal,
				isDynamicHeight: itemProps.isDynamicHeight,
				estimatedItemHeight: itemProps.estimatedItemHeight,
				itemHeights: itemProps.itemHeights,
				scheduleHeightUpdate: itemProps.scheduleHeightUpdate,
			}}
			onDrop={onDrop}
		/>;
	}, [themeId, onDrop]);

	return <Sortable
		key={`${resetCounter}:${noteSignature}`}
		data={sortableNotes}
		renderItem={renderItem}
		enableDynamicHeights={true}
		useFlatList={true}
	/>;
};

export default ReorderNotesList;

// cspell:words draglist
import * as React from 'react';

import { Component } from 'react';

import { connect } from 'react-redux';
import { FlatList, Text, StyleSheet, Button, View } from 'react-native';
import { FolderEntity, NoteEntity } from '@joplin/lib/services/database/types';
import { AppState } from '../utils/types';
import getEmptyFolderMessage from '@joplin/lib/components/shared/NoteList/getEmptyFolderMessage';
import Folder from '@joplin/lib/models/Folder';
import Note from '@joplin/lib/models/Note';
import DragList, { DragListRenderItemInfo } from 'react-native-draglist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { _ } = require('@joplin/lib/locale');
import NoteItem from './NoteItem';
import { themeStyle } from './global-style';

interface DragListContainerProps<T> {
	data: T[];
	renderItem: (info: DragListRenderItemInfo<T>)=> React.ReactElement | null;
	keyExtractor: (item: T)=> string;
	onReordered: (fromIndex: number, toIndex: number)=> void;
}

function DragListContainer<T>(props: DragListContainerProps<T>) {
	const insets = useSafeAreaInsets();
	const [isDragging, setIsDragging] = React.useState(false);

	const handleDragBegin = React.useCallback(() => {
		setIsDragging(true);
	}, []);

	const handleDragEnd = React.useCallback(() => {
		setIsDragging(false);
	}, []);

	// Wrap renderItem to inject drag state handlers
	const wrappedRenderItem = React.useCallback((info: DragListRenderItemInfo<T>) => {
		const originalOnDragStart = info.onDragStart;
		const originalOnDragEnd = info.onDragEnd;

		const wrappedInfo = {
			...info,
			onDragStart: () => {
				handleDragBegin();
				originalOnDragStart();
			},
			onDragEnd: () => {
				handleDragEnd();
				originalOnDragEnd();
			},
		};
		return props.renderItem(wrappedInfo);
	}, [props.renderItem, handleDragBegin, handleDragEnd]);

	return (
		<View style={{ flex: 1, marginBottom: insets.bottom }}>
			<DragList
				data={props.data}
				renderItem={wrappedRenderItem}
				keyExtractor={props.keyExtractor}
				onReordered={props.onReordered}
				scrollEnabled={!isDragging}
			/>
		</View>
	);
}

interface NoteListProps {
	themeId: number;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Old code before rule was applied
	dispatch: (action: any)=> void;
	notesSource: string;
	items: NoteEntity[];
	folders: FolderEntity[];
	noteSelectionEnabled?: boolean;
	selectedFolderId: string|null;
	noteReorderModeEnabled: boolean;
	uncompletedTodosOnTop: boolean;
	showCompletedTodos: boolean;
}

const isUncompletedTodo = (note: NoteEntity): boolean => {
	return !!note?.is_todo && !note?.todo_completed;
};

const canMoveToIndex = (
	notes: NoteEntity[],
	fromIndex: number,
	toIndex: number,
	uncompletedTodosOnTop: boolean,
): boolean => {
	if (fromIndex === toIndex) return true;
	if (toIndex < 0 || toIndex >= notes.length) return false;

	if (!uncompletedTodosOnTop) return true;

	const movingNote = notes[fromIndex];
	const movingIsUncompleted = isUncompletedTodo(movingNote);

	// Find the boundary index between uncompleted todos and other notes
	let boundaryIndex = notes.length;
	for (let i = 0; i < notes.length; i++) {
		if (!isUncompletedTodo(notes[i])) {
			boundaryIndex = i;
			break;
		}
	}

	// Uncompleted todos must stay in the uncompleted section (indices 0 to boundaryIndex-1)
	// Other notes must stay in the other section (indices boundaryIndex to end)
	if (movingIsUncompleted) {
		// Moving an uncompleted todo - must stay before the boundary
		return toIndex < boundaryIndex;
	} else {
		// Moving a completed/non-todo note - must stay at or after the boundary
		return toIndex >= boundaryIndex;
	}
};

class NoteListComponent extends Component<NoteListProps> {
	private rootRef_: FlatList;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Old code before rule was applied
	private styles_: Record<string, StyleSheet.NamedStyles<any>>;

	public constructor(props: NoteListProps) {
		super(props);

		this.state = {
			items: [],
			selectedItemIds: [],
		};
		this.rootRef_ = null;
		this.styles_ = {};

		this.createNotebookButton_click = this.createNotebookButton_click.bind(this);
	}

	private styles() {
		const themeId = this.props.themeId;
		const theme = themeStyle(themeId);

		if (this.styles_[themeId]) return this.styles_[themeId];
		this.styles_ = {};

		const styles = {
			noItemMessage: {
				paddingLeft: theme.marginLeft,
				paddingRight: theme.marginRight,
				paddingTop: theme.marginTop,
				paddingBottom: theme.marginBottom,
				fontSize: theme.fontSize,
				color: theme.color,
				textAlign: 'center',
			},
			noNotebookView: {

			},
		};

		this.styles_[themeId] = StyleSheet.create(styles);
		return this.styles_[themeId];
	}

	private createNotebookButton_click() {
		this.props.dispatch({
			type: 'NAV_GO',
			routeName: 'Folder',
			folderId: null,
		});
	}

	public UNSAFE_componentWillReceiveProps(newProps: NoteListProps) {
		// Make sure scroll position is reset when switching from one folder to another or to a tag list.
		if (this.rootRef_ && newProps.notesSource !== this.props.notesSource) {
			this.rootRef_.scrollToOffset({ offset: 0, animated: false });
		}
	}

	private handleReordered = (fromIndex: number, toIndex: number) => {
		if (fromIndex === toIndex) {
			// Force a re-render to reset the dragged item position
			this.props.dispatch({ type: 'NOTE_SORT' });
			return;
		}

		// Validate the move
		if (!canMoveToIndex(this.props.items, fromIndex, toIndex, this.props.uncompletedTodosOnTop)) {
			// Invalid move - force a re-render to snap item back to original position
			this.props.dispatch({ type: 'NOTE_SORT' });
			return;
		}

		const movedNote = this.props.items[fromIndex];
		if (!movedNote?.id || !this.props.selectedFolderId) {
			this.props.dispatch({ type: 'NOTE_SORT' });
			return;
		}

		// Dispatch local reorder for immediate UI update
		this.props.dispatch({
			type: 'NOTE_REORDER_LOCAL',
			noteId: movedNote.id,
			fromIndex: fromIndex,
			toIndex: toIndex,
		});

		// Calculate the target index for insertNotesAt
		// When moving down, we need to add 1 because insertNotesAt inserts BEFORE the target
		const targetIndex = toIndex > fromIndex ? toIndex + 1 : toIndex;

		// Persist the change in the background (don't await)
		void Note.insertNotesAt(
			this.props.selectedFolderId,
			[movedNote.id],
			targetIndex,
			this.props.uncompletedTodosOnTop,
			this.props.showCompletedTodos,
		);
	};

	private renderDraggableItem = (info: DragListRenderItemInfo<NoteEntity>) => {
		const { item, onDragStart, onDragEnd, isActive } = info;
		const index = this.props.items.findIndex(n => n.id === item.id);
		return (
			<NoteItem
				note={item}
				noteIndex={index}
				totalNotes={this.props.items.length}
				notes={this.props.items}
				noteReorderModeEnabled={this.props.noteReorderModeEnabled}
				uncompletedTodosOnTop={this.props.uncompletedTodosOnTop}
				showCompletedTodos={this.props.showCompletedTodos}
				folderId={this.props.selectedFolderId}
				onDragStart={onDragStart}
				onDragEnd={onDragEnd}
				isActive={isActive}
			/>
		);
	};

	public render() {
		// `enableEmptySections` is to fix this warning: https://github.com/FaridSafi/react-native-gifted-listview/issues/39

		if (this.props.items.length) {
			if (this.props.noteReorderModeEnabled) {
				return (
					<DragListContainer
						data={this.props.items}
						renderItem={this.renderDraggableItem}
						keyExtractor={item => item.id}
						onReordered={this.handleReordered}
					/>
				);
			}

			return <FlatList
				ref={ref => { this.rootRef_ = ref; }}
				data={this.props.items}
				renderItem={({ item, index }) => <NoteItem
					note={item}
					noteIndex={index}
					totalNotes={this.props.items.length}
					notes={this.props.items}
					noteReorderModeEnabled={this.props.noteReorderModeEnabled}
					uncompletedTodosOnTop={this.props.uncompletedTodosOnTop}
					showCompletedTodos={this.props.showCompletedTodos}
					folderId={this.props.selectedFolderId}
				/>}
				keyExtractor={item => item.id}
			/>;
		} else {
			if (!Folder.atLeastOneRealFolderExists(this.props.folders)) {
				const noItemMessage = _('You currently have no notebooks.');
				return (
					<View style={this.styles().noNotebookView}>
						<Text style={this.styles().noItemMessage}>{noItemMessage}</Text>
						<Button title={_('Create a notebook')} onPress={this.createNotebookButton_click} />
					</View>
				);
			} else {
				return <Text style={this.styles().noItemMessage}>
					{getEmptyFolderMessage(this.props.folders, this.props.selectedFolderId)}
				</Text>;
			}
		}
	}
}


const NoteList = connect((state: AppState) => {
	return {
		items: state.notes,
		folders: state.folders,
		notesSource: state.notesSource,
		themeId: state.settings.theme,
		noteSelectionEnabled: state.noteSelectionEnabled,
		selectedFolderId: state.selectedFolderId,
		noteReorderModeEnabled: state.noteReorderModeEnabled,
		uncompletedTodosOnTop: state.settings.uncompletedTodosOnTop,
		showCompletedTodos: state.settings.showCompletedTodos,
	};
})(NoteListComponent);

export default NoteList;

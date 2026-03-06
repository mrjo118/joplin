"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
const react_1 = require("react");
const react_native_1 = require("react-native");
const Modal_1 = require("../../Modal");
const global_style_1 = require("../../global-style");
const locale_1 = require("@joplin/lib/locale");
const Note_1 = require("@joplin/lib/models/Note");
const buttons_1 = require("../../buttons");
const MOVE_TO_TOP_VALUE = '__MOVE_TO_TOP__';
const MAX_NOTE_TITLE_LENGTH = 30;
const truncateTitle = (title, maxLength) => {
    if (title.length <= maxLength)
        return title;
    return title.substring(0, maxLength - 3) + '...';
};
// Returns true if the note is an uncompleted todo
const isUncompletedTodo = (note) => {
    return !!note.is_todo && !note.todo_completed;
};
const useStyles = (themeId) => {
    return (0, react_1.useMemo)(() => {
        const theme = (0, global_style_1.themeStyle)(themeId);
        return react_native_1.StyleSheet.create({
            container: {
                borderRadius: 8,
                backgroundColor: theme.backgroundColor,
                maxWidth: 500,
                width: '90%',
                alignSelf: 'center',
                marginVertical: 'auto',
                padding: theme.margin,
                maxHeight: '80%',
            },
            heading: {
                fontSize: theme.fontSize * 1.2,
                fontWeight: 'bold',
                color: theme.color,
                marginBottom: theme.marginBottom,
            },
            description: {
                fontSize: theme.fontSize,
                color: theme.color,
                marginBottom: theme.marginBottom * 1.5,
            },
            noteName: {
                fontWeight: 'bold',
            },
            dropdownLabel: {
                fontSize: theme.fontSize * 0.9,
                color: theme.colorFaded,
                marginBottom: 8,
            },
            listContainer: {
                borderWidth: 1,
                borderColor: theme.dividerColor,
                borderRadius: 4,
                maxHeight: 250,
                marginBottom: theme.marginBottom,
            },
            listItem: {
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.dividerColor,
            },
            listItemLast: {
                borderBottomWidth: 0,
            },
            listItemSelected: {
                backgroundColor: theme.selectedColor,
            },
            listItemDisabled: {
                opacity: 0.4,
            },
            listItemText: {
                fontSize: theme.fontSize,
                color: theme.color,
            },
            buttonContainer: {
                flexDirection: 'row',
                justifyContent: 'flex-end',
                marginTop: theme.marginTop,
            },
        });
    }, [themeId]);
};
const RearrangeNoteModal = (props) => {
    const { visible, selectedNote, notes, onClose, onConfirm, themeId, uncompletedTodosOnTop } = props;
    const styles = useStyles(themeId);
    const theme = (0, global_style_1.themeStyle)(themeId);
    const [selectedTargetValue, setSelectedTargetValue] = (0, react_1.useState)(MOVE_TO_TOP_VALUE);
    // Calculate valid move positions based on uncompletedTodosOnTop setting
    const { listItems } = (0, react_1.useMemo)(() => {
        if (!selectedNote) {
            return { listItems: [] };
        }
        const selectedIsUncompleted = isUncompletedTodo(selectedNote);
        // Find the boundary between uncompleted todos and completed/non-todos
        let lastUncompletedTodoIndex = -1;
        let firstCompletedOrNonTodoIndex = notes.length;
        if (uncompletedTodosOnTop) {
            for (let i = 0; i < notes.length; i++) {
                if (isUncompletedTodo(notes[i])) {
                    lastUncompletedTodoIndex = i;
                }
            }
            firstCompletedOrNonTodoIndex = lastUncompletedTodoIndex + 1;
        }
        // Find the current index of the selected note
        const selectedNoteCurrentIndex = notes.findIndex(n => n.id === selectedNote.id);
        // Determine if MOVE TO TOP is valid
        // Disabled if:
        // 1. uncompletedTodosOnTop is true and the note is completed/non-todo (can't move above uncompleted todos)
        // 2. The note is already at the very top of the list (index 0)
        const effectiveTopIndex = (selectedIsUncompleted || !uncompletedTodosOnTop) ? 0 : firstCompletedOrNonTodoIndex;
        const isAlreadyAtTop = selectedNoteCurrentIndex === 0;
        const moveToTopDisabled = (uncompletedTodosOnTop && !selectedIsUncompleted) || isAlreadyAtTop;
        const items = [
            {
                id: MOVE_TO_TOP_VALUE,
                title: (0, locale_1._)('[MOVE TO TOP]'),
                isMoveToTop: true,
                isDisabled: moveToTopDisabled,
                targetIndex: effectiveTopIndex,
            },
            ...notes.map((note, index) => {
                // Disable if:
                // 1. It's the selected note itself
                // 2. Moving after this note would put the selected note outside its valid range
                const targetIndexAfterThisNote = index + 1;
                const isOutOfRange = uncompletedTodosOnTop && ((selectedIsUncompleted && index > lastUncompletedTodoIndex) ||
                    (!selectedIsUncompleted && index < firstCompletedOrNonTodoIndex - 1));
                return {
                    id: note.id,
                    title: Note_1.default.displayTitle(note),
                    isMoveToTop: false,
                    isDisabled: note.id === selectedNote.id || isOutOfRange,
                    targetIndex: targetIndexAfterThisNote,
                };
            }),
        ];
        return { listItems: items };
    }, [selectedNote, notes, uncompletedTodosOnTop]);
    // Reset selection when modal opens - select first valid option
    React.useEffect(() => {
        if (visible && listItems.length > 0) {
            const firstValidItem = listItems.find(item => !item.isDisabled);
            if (firstValidItem) {
                setSelectedTargetValue(firstValidItem.id);
            }
            else {
                setSelectedTargetValue(MOVE_TO_TOP_VALUE);
            }
        }
    }, [visible, listItems]);
    const handleConfirm = (0, react_1.useCallback)(() => {
        const selectedItem = listItems.find(item => item.id === selectedTargetValue);
        if (selectedItem && !selectedItem.isDisabled) {
            onConfirm(selectedItem.targetIndex);
        }
    }, [selectedTargetValue, listItems, onConfirm]);
    if (!selectedNote)
        return null;
    const noteTitle = Note_1.default.displayTitle(selectedNote);
    const truncatedTitle = truncateTitle(noteTitle, MAX_NOTE_TITLE_LENGTH);
    return (React.createElement(Modal_1.default, { visible: visible, onClose: onClose, backgroundColor: theme.backgroundColorTransparent2, containerStyle: styles.container },
        React.createElement(react_native_1.Text, { style: styles.heading }, (0, locale_1._)('Re-arrange notes')),
        React.createElement(react_native_1.Text, { style: styles.description }, (0, locale_1._)('Move note "%s" below the selected note', truncatedTitle)),
        React.createElement(react_native_1.Text, { style: styles.dropdownLabel }, (0, locale_1._)('Select target position:')),
        React.createElement(react_native_1.View, { style: styles.listContainer },
            React.createElement(react_native_1.ScrollView, null, listItems.map((item, index) => {
                const isSelected = selectedTargetValue === item.id;
                const isLast = index === listItems.length - 1;
                return (React.createElement(react_native_1.TouchableOpacity, { key: item.id, style: [
                        styles.listItem,
                        isLast && styles.listItemLast,
                        isSelected && styles.listItemSelected,
                        item.isDisabled && styles.listItemDisabled,
                    ], onPress: () => {
                        if (!item.isDisabled) {
                            setSelectedTargetValue(item.id);
                        }
                    }, disabled: item.isDisabled, accessibilityRole: "radio", accessibilityState: { checked: isSelected, disabled: item.isDisabled } },
                    React.createElement(react_native_1.Text, { style: [
                            styles.listItemText,
                        ], numberOfLines: 1, ellipsizeMode: "tail" }, item.title)));
            }))),
        React.createElement(react_native_1.View, { style: styles.buttonContainer },
            React.createElement(buttons_1.PrimaryButton, { onPress: handleConfirm }, (0, locale_1._)('Confirm')))));
};
exports.default = RearrangeNoteModal;
//# sourceMappingURL=RearrangeNoteModal.js.map
import { DOMParser as ProseMirrorDomParser, DOMSerializer } from 'prosemirror-model';
import schema from './schema';

describe('schema', () => {
	test('should preserve foreground and background colours around mark elements', () => {
		const input = new DOMParser().parseFromString(
			'<mark style="color: red; background-color: yellow;">Highlighted</mark>',
			'text/html',
		);
		const parsedDocument = ProseMirrorDomParser.fromSchema(schema).parse(input);
		const textNode = parsedDocument.firstChild.firstChild;

		expect(textNode.marks.find(mark => mark.type === schema.marks.color)?.attrs.color).toBe('red');
		expect(textNode.marks.find(mark => mark.type === schema.marks.backgroundColor)?.attrs.backgroundColor).toBe('yellow');

		const output = document.createElement('div');
		output.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(parsedDocument.content));

		const markElement = output.querySelector('mark') as HTMLElement;
		const backgroundColorElement = markElement.parentElement as HTMLElement;
		const colorElement = backgroundColorElement.parentElement as HTMLElement;

		expect(markElement.textContent).toBe('Highlighted');
		expect(backgroundColorElement.style.backgroundColor).toBe('yellow');
		expect(colorElement.style.color).toBe('red');
	});
});

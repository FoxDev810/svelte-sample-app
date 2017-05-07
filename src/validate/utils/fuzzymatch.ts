import FuzzySet from './FuzzySet';

export default function fuzzymatch ( name, names ) {
	const set = new FuzzySet( names );
	const matches = set.get( name );

	return matches && matches[0] && matches[0][0] > 0.7 ?
		matches[0][1] :
		null;
}
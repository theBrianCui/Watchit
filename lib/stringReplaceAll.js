// Multiple string replace in one pass
// https://stackoverflow.com/questions/15604140/replace-multiple-strings-with-multiple-other-strings
module.exports = function(str, mapObj){
    var re = new RegExp(Object.keys(mapObj).join("|"),"gi");
    
    return str.replace(re, function(matched){
	return mapObj[matched.toLowerCase()];
    });
};

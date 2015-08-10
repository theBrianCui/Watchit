module.exports = function(argv) {
	var argList = process.argv;
	//Avoid mutating argv, just in case
	var newArgs = {};

	for(var arg in argv) {
		switch (typeof argv[arg]) {
			case 'boolean':
				newArgs[arg] = (argList.indexOf('-' + arg.charAt(0)) !== -1
				|| argList.indexOf('--' + arg) !== -1);
				break;
			case 'string':
			case 'number':
				var index = argList.indexOf('-' + arg.charAt(0));
				if(index === -1) index = argList.indexOf('--' + arg);
				//A bit silly, but -1 isn't falsy and we have to get the actual index value
				if(index !== -1 && argList[index + 1] != null && !(/^-{1,2}[a-z]+$/g.test(argList[index + 1]))) {
					newArgs[arg] = argList[index + 1];
				} else {
					newArgs[arg] = argv[arg];
				}
				break;
		}
	}

	return newArgs;
};
    

{printable_usage, parse_doc_options, formal_usage, parse_args, extras, Option, Argument, Command, Dict, DocoptExit} = require './docopt'
{grammar, semantics, translateAST} = require './parser'

parse_pattern = (source, options) ->
    m = grammar.match(source)
    if m.succeeded()
      result = semantics(m).ast()  # Evaluate the expression.
    else
      throw m.message  # Extract the error message.

    translateAST result

docopt = (doc, kwargs={}) ->
    allowedargs = ['argv', 'name', 'help', 'version']
    throw new Error "unrecognized argument to docopt: " for arg of kwargs \
        when arg not in allowedargs

    argv    = if kwargs.argv is undefined \
              then process.argv[2..] else kwargs.argv
    name    = if kwargs.name is undefined \
              then null else kwargs.name
    help    = if kwargs.help is undefined \
              then true else kwargs.help
    version = if kwargs.version is undefined \
              then null else kwargs.version

    usage = printable_usage doc, name
    pot_options = parse_doc_options doc
    formal_pattern   = parse_pattern formal_usage(usage), pot_options

    argv = parse_args argv, pot_options
    extras help, version, argv, doc
    [matched, left, argums] = formal_pattern.fix().match argv
    if matched and left.length is 0  # better message if left?
        options = (opt for opt in argv when opt.constructor is Option)
        pot_arguments = (a for a in formal_pattern.flat() \
            when a.constructor in [Argument, Command])
        parameters = [].concat pot_options, options, pot_arguments, argums
        return new Dict([a.name(), a.value] for a in parameters)
    throw new DocoptExit usage

module.exports =
  docopt: docopt

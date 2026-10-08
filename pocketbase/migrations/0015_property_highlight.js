migrate(
  (app) => {
    const props = app.findCollectionByNameOrId('properties')
    props.fields.add(
      new SelectField({
        name: 'highlight_level',
        values: ['comum', 'destaque', 'super_destaque'],
        maxSelect: 1,
      }),
    )
    props.fields.add(new DateField({ name: 'highlight_until' }))
    app.save(props)
  },
  (app) => {
    const props = app.findCollectionByNameOrId('properties')
    props.fields.removeByName('highlight_level')
    props.fields.removeByName('highlight_until')
    app.save(props)
  },
)

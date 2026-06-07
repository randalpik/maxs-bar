## This Document

This document (backlog.md) is the source of truth for Max's perspective on the future and current state of the Max's Bar app. It should be referenced whenever you have a question about how a new feature is going to be used, or how Max expects something to work on a conceptual level. It can also be used to suggest a next task if prompted.

IMPORTANT: Max owns this document completely. You may suggest small changes such as removing an item once complete or changing an item to reflect new functionality, but NEVER do this without explicitly asking for permission, even in auto mode. This would defeat the purpose of this document; I'd rather have some slightly outdated thoughts that were verifiably mine, than have it be automatically updated but drifted from my mental model. Any other document is fair game to edit as you see fit.

## Current functionality

The version 0.1 prototype seed of this repo is a single HTML file containing the skeleton structure of the app, including the following features:
- Intake an existing list of cocktail recipes via a text file in a defined shorthand format, and store in local storage as the source of truth for the UI
- Display recipes in a list including title, base spirit, preparation, and standard drinks count
- Display ingredient chips for each recipe with abstract icons, names, and amounts
- Sort recipes by a variety of criteria, or group them into categories (allowing duplicates)
- Filter recipes by keyword
- Add a new recipe to the list
- Edit an existing recipe's title or source string
- Export the current list as a text file or csv
- Authoritative base list embedded into the app by default for testing

## Backlog

Skeleton roadmap:
- New ingredients page with ingredients sorted by category; toggle whether an ingredient is currently stocked, unstocked items appear with a red background in recipes
- Sort recipes by number of missing ingredients
- Button on each ingredient to populate filter with that ingredient
- One-off icon designs for common items without icons
- Allow import from csv
- Split the seed into an actual csv file source in the repo; allow user to opt into using Max's recipes as the base, but default to blank
- Add third readonly tab for syrup recipe reference (the remaining info in my original drinks document)

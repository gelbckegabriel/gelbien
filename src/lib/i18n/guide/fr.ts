import type { GuideContent } from ".";

const fr: GuideContent = {
  start: {
    title: "Premiers pas",
    summary: "Ce qu'est Gelbien, où vivent vos données et quoi configurer en premier.",
    intro: [
      "Gelbien vous aide à voir où va votre argent et à décider où il devrait aller. Vous notez vos dépenses, donnez un budget à chaque mois, listez les factures qui reviennent et épargnez pour vos objectifs. En retour, vous avez une vue claire de chaque mois : ce qui reste, ce qui arrive et ce qu'il faut changer.",
      "Vos données vivent dans une feuille Google de votre propre Google Drive, appelée **Gelbien — votre nom**, créée la première fois que vous vous connectez. Gelbien ne peut ouvrir que les fichiers qu'il crée, pas le reste de votre Drive, et il ne demande jamais vos mots de passe bancaires. Tout ce que vous enregistrez va dans cette feuille : elle est à vous, pour l'ouvrir, la sauvegarder ou la supprimer.",
      "Simple curiosité ? **Découvrir la démo**, sur la page de connexion, charge des données d'exemple qui restent dans votre navigateur. Vous pourrez vous connecter avec Google plus tard, depuis le Profil.",
    ],
    steps: [
      { title: "Connectez-vous avec Google", body: "Sur la page de connexion, choisissez **Continuer avec Google** et laissez cochée l'autorisation Google Drive : Gelbien en a besoin pour créer sa feuille. Cela n'arrive qu'une fois ; ensuite, vous arrivez directement sur votre tableau de bord." },
      { title: "Choisissez la langue et la devise", body: "Allez dans **Profil → Préférences**. Choisissez English, Português ou Français, et la devise de tous les montants. Les deux sont enregistrées dans votre feuille : tous vos appareils les suivent." },
      { title: "Indiquez vos revenus et un budget", body: "Sur la page **Budget**, saisissez votre revenu net mensuel et une limite de dépenses pour les catégories qui comptent. Vous ne savez pas quelles limites choisir ? **Suggérer d'après 3 mois** fonctionne dès que vous avez noté quelques semaines de dépenses. Voir Budget plus bas." },
      { title: "Listez vos factures récurrentes", body: "Loyer, téléphone, assurance, streaming : ajoutez-les dans **Dépenses récurrentes**, sur la page Budget. Gelbien vous rappelle alors leurs échéances et met cet argent de côté dans votre budget avant qu'il ne parte." },
      { title: "Notez vos dépenses au fil de l'eau", body: "Touchez le bouton doré **+** à chaque dépense. Cela prend quelques secondes, et plus vous êtes régulier, plus les graphiques, les observations et les suggestions deviennent utiles." },
      { title: "En option : vos comptes et un objectif", body: "Sur la page **Objectifs**, ajoutez vos comptes bancaires et cartes, puis un objectif comme un voyage ou une voiture. Une fois par mois, vous mettez les soldes à jour, et Gelbien affiche votre valeur nette et quand vous atteindrez chaque objectif." },
    ],
    tips: [
      "Le **sélecteur de mois**, en haut de chaque page, choisit le mois affiché. Le tableau de bord, le budget et la liste des dépenses le suivent. Touchez le nom du mois pour aller à n'importe quel mois, ou **Ce mois-ci** pour revenir.",
      "Pour revenir à ce guide : sur téléphone, touchez votre photo en haut à droite, puis **Guide** ; sur ordinateur, utilisez le bouton **?** en haut de chaque page, ou **Guide** dans le menu latéral. Il s'ouvre à la section de la page où vous étiez.",
      "Gelbien fonctionne sur téléphone et sur ordinateur. Sur téléphone, utilisez **Ajouter à l'écran d'accueil** de votre navigateur pour l'ouvrir comme une application.",
      "Si un enregistrement échoue (pas de connexion, stockage Google plein…), Gelbien vous dit pourquoi et garde ce que vous avez saisi pour réessayer. Rien n'est perdu.",
    ],
  },

  add: {
    title: "Ajouter une dépense",
    summary: "Le bouton +, les reçus et l'IA, répartir un achat, les remboursements et les modifications.",
    intro: [
      "Noter une dépense, c'est ce que vous ferez le plus souvent : c'est conçu pour prendre quelques secondes. Ouvrez le formulaire **Nouvelle dépense** avec le bouton doré **+** (en bas à droite sur ordinateur, au centre de la barre du bas sur téléphone), le bouton **Nouvelle dépense** du menu latéral, ou en appuyant sur **N** n'importe où dans l'application.",
      "Seuls le montant et la catégorie sont obligatoires. Le reste affine vos graphiques et vos suggestions, et une bonne partie se remplit toute seule.",
    ],
    steps: [
      { title: "Montant et date", body: "Saisissez le montant. La date est celle d'aujourd'hui ; changez-la si vous rattrapez une dépense passée. Les dates futures ne sont pas acceptées : notez les choses quand elles arrivent." },
      { title: "Commerçant et description", body: "**Commerçant**, c'est où vous avez payé (épicerie, Uber, votre propriétaire) ; **Description**, c'est ce que c'était (courses de la semaine, taxi du retour). Si vous avez déjà acheté chez ce commerçant, quitter le champ remplit la catégorie, la sous-catégorie, le moyen de paiement, le type et la priorité de la dernière fois. Vous verrez « Rempli d'après votre historique chez… »." },
      { title: "Catégorie et sous-catégorie", body: "Touchez une catégorie. Si elle a des sous-catégories (Épicerie → Supermarché, Boulangerie…), elles apparaissent juste en dessous pour plus de détail ; en choisir une est facultatif. La catégorie règle aussi le type et la priorité que vous lui donnez d'habitude. Les catégories se modifient sur la page Catégories." },
      { title: "Paiement, type et priorité", body: "**Paiement**, c'est la carte ou le compte utilisé ; le dernier est présélectionné. **Type** : Fixe pour les coûts identiques chaque mois (loyer, forfait), Variable pour ceux qui changent (épicerie, restaurants). **Priorité** : Essentiel (vous en avez besoin), Important (utile mais flexible) ou Superflu (agréable, sans plus). Soyez honnête avec les priorités : elles alimentent le graphique Essentiel vs. superflu et les conseils du bilan du mois." },
      { title: "Enregistrer", body: "**Enregistrer** ferme le formulaire. Sur ordinateur, **Enregistrer et en ajouter une autre** le garde ouvert pour la suivante. Chaque enregistrement affiche **Annuler** pendant quelques secondes, au cas où vous seriez allé trop vite." },
      { title: "Lire un reçu (facultatif)", body: "En haut du formulaire, déposez, joignez ou collez une photo ou un PDF du reçu. Sur téléphone, **Appareil photo** prend la photo. Vous pouvez aussi coller un reçu (Ctrl/⌘+V) ou glisser un fichier sur n'importe quelle page pour démarrer une nouvelle dépense avec. Avec une IA connectée dans le Profil, Gelbien lit le montant, la date, le commerçant, la catégorie et plus encore. Les champs qu'il a remplis portent l'étiquette **IA**, et ceux dont il n'était pas sûr un ⚠, pour savoir quoi vérifier. Laissez **Copier dans Drive** activé pour ranger le reçu dans un dossier « Gelbien Receipts » de votre Drive, ou désactivez-le pour ne vous en servir que pour remplir le formulaire." },
      { title: "Répartir un achat entre catégories", body: "Un reçu avec plusieurs genres de dépenses, comme l'épicerie et un pull au même magasin ? Touchez **Répartir**, au-dessus des catégories. Donnez à chaque partie une catégorie et un montant (et, si vous voulez, les articles) ; le total est la somme des parties, et chacune compte dans le budget de sa catégorie. **Une seule catégorie** les regroupe à nouveau." },
      { title: "Notes, dépenses récurrentes et remboursements", body: "Touchez **+ Notes · dépense récurrente · remboursement** pour les options. **Notes** : tout ce que vous voulez retenir. **Dépense récurrente** : relie ce paiement à l'une de vos factures récurrentes, ou l'ajoute comme nouvelle sur la page Budget (voir Factures récurrentes). **C'est un remboursement** : de l'argent qui vous revient ; il réduit les dépenses de la catégorie et s'affiche en vert." },
      { title: "Modifier ou supprimer", body: "Touchez n'importe quelle dépense (dans la liste des Dépenses ou dans des listes comme Plus grosses dépenses) pour la rouvrir. Modifiez ce qu'il faut et enregistrez, ou supprimez-la avec la corbeille. La suppression demande une confirmation et propose Annuler." },
    ],
    tips: [
      "Pas d'IA connectée ? Tout fonctionne quand même ; vous saisissez simplement les champs vous-même.",
      "Les requêtes IA vont directement de votre navigateur au fournisseur choisi. Votre clé reste uniquement dans votre navigateur.",
      "Notez sur le moment, même approximativement. Une dépense approximative aujourd'hui vaut mieux qu'une dépense parfaite oubliée.",
    ],
  },

  dashboard: {
    title: "Tableau de bord",
    summary: "Votre mois d'un coup d'œil : ce qui reste, ce qui arrive et où est passé l'argent.",
    intro: [
      "Le tableau de bord répond à une question : comment s'en sort-on ce mois-ci ? Tout y suit le sélecteur de mois en haut et se met à jour dès que vous ajoutez une dépense. Le voici de haut en bas.",
    ],
    steps: [
      { title: "Les bandeaux : ce qu'il faut faire maintenant", body: "Ils n'apparaissent que lorsque c'est utile. **C'est l'heure de votre bilan mensuel** vous invite à mettre à jour les soldes de vos comptes (voir Objectifs). **« Mois » est terminé — voici le bilan** ouvre le bilan du mois qui vient de finir. **Ces factures sont-elles payées ?** liste les factures récurrentes prélevées récemment sans dépense notée : touchez **Payé** (ou **Toutes payées**) pour les noter, ou ✕ pour en passer une cette fois." },
      { title: "Le grand chiffre : dépensé ce mois-ci", body: "Combien vous avez dépensé par rapport à votre budget, combien il **reste**, et combien de ce reste est déjà promis à des factures à payer. La ligne « …/jour disponibles pour les N prochains jours » est votre allocation quotidienne : dépensez moins que cela chaque jour et vous finirez le mois dans le budget. Pour un mois passé, elle affiche le résultat final." },
      { title: "Les tuiles", body: "**Épargné** (ou **Déficit**) : revenu net moins dépenses, avec votre taux d'épargne. **Moyenne par jour** des dépenses. **Superflu** : ce qui est allé à des choses marquées superflues. **Autonomie** : combien de mois votre épargne durerait si vous continuiez à dépenser plus que vous ne gagnez (il faut vos comptes dans Objectifs ; **Durable** signifie que vos revenus couvrent vos dépenses). Puis **Frais fixes**, le nombre de **Transactions**, **Récurrent / mois** (factures et abonnements par mois) et ce que vous avez dépensé cette année." },
      { title: "Observations", body: "De courtes notes sur ce qui ressort : une catégorie au-dessus du budget, des dépenses en avance sur le rythme, une catégorie en hausse ou en baisse par rapport à l'habitude, un essai gratuit qui se termine. Avec l'IA connectée, **Demander à l'IA** ajoute une lecture personnalisée de votre mois." },
      { title: "Les graphiques", body: "**Rythme des dépenses** : vos dépenses cumulées face à un rythme régulier et au mois dernier. **Où est passé l'argent** : la part de chaque catégorie. **Budget par catégorie** : dépensé vs limite. **Prochains prélèvements** : les 30 prochains jours (touchez ✓ pour noter un prélèvement déjà payé). **Tendance sur 12 mois** : revenus, dépenses et épargne par mois. **Dépenses quotidiennes** : un calendrier où plus clair veut dire journée plus chargée. **Flux d'argent** : des revenus vers les catégories et l'épargne. Puis **Essentiel vs. superflu**, **Moyens de paiement**, **Plus grosses dépenses**, **Projection de l'épargne**, **Par jour de la semaine** et **L'année d'un coup d'œil**." },
    ],
    tips: [
      "Chaque graphique a un bouton tableau dans son coin, qui remplace l'image par les chiffres exacts.",
      "Les graphiques montrent vos plus grosses catégories et regroupent le reste sous « Le reste » pour rester lisibles.",
      "Regardez les mois passés avec le sélecteur de mois : le tableau de bord devient le résumé de ce mois-là.",
    ],
  },

  expenses: {
    title: "Dépenses",
    summary: "Tout ce que vous avez noté : chercher, filtrer, modifier, supprimer ou exporter.",
    intro: [
      "La page Dépenses liste tout ce que vous avez noté, regroupé par jour avec le total de chaque journée. L'en-tête indique combien de dépenses correspondent et leur total. Elle commence sur le mois choisi en haut ; passez à **Toute la période** pour chercher dans tout l'historique.",
    ],
    steps: [
      { title: "Trouver une dépense", body: "Tapez dans la recherche pour chercher dans les descriptions, les commerçants et les notes. Filtrez par catégorie, priorité ou moyen de paiement, et triez par **Plus récentes** ou **Plus importantes**. **Effacer les filtres** réaffiche tout." },
      { title: "Lire une ligne", body: "Chaque ligne affiche la description, la sous-catégorie (ou la catégorie), le commerçant et le moyen de paiement, le montant et la priorité. De petites icônes signalent les dépenses récurrentes (↻), les achats répartis entre catégories et les reçus joints (📎). Les remboursements apparaissent en vert." },
      { title: "Modifier ou supprimer", body: "Touchez une ligne pour ouvrir la dépense dans le formulaire. Modifiez ce que vous voulez et enregistrez, ou supprimez-la. Un achat réparti s'ouvre avec toutes ses parties." },
      { title: "Exporter", body: "**Exporter en CSV** télécharge les dépenses affichées, filtres compris, dans un fichier qui s'ouvre avec n'importe quel tableur." },
    ],
    tips: [
      "Sur la page Budget, toucher une catégorie ouvre cette liste déjà filtrée sur elle pour le mois.",
      "Recherche + **Toute la période**, c'est le plus rapide pour savoir « quand ai-je payé… pour la dernière fois ? »",
    ],
  },

  budget: {
    title: "Budget",
    summary: "Vos revenus, une limite par catégorie, et l'avancée du mois par rapport au plan.",
    intro: [
      "Un budget est un plan pour vos revenus : combien vous vous accordez par catégorie, et ce qui reste à épargner. Gelbien compare ce plan à vos dépenses réelles tout au long du mois, pour corriger le tir avant la fin du mois au lieu de le découvrir après.",
      "Un premier budget n'a pas besoin d'être parfait. Partez de ce que vous dépensez vraiment, puis baissez une ou deux catégories chaque mois.",
    ],
    steps: [
      { title: "Saisissez vos revenus", body: "Dans **Revenus**, indiquez votre revenu mensuel **Brut** (avant impôts) et **Net** (après impôts). Gelbien utilise le net, ce qui arrive vraiment sur votre compte, pour tout le reste, et affiche les impôts et retenues entre les deux avec votre taux effectif." },
      { title: "Fixez une limite par catégorie", body: "Dans **Limites de dépenses**, saisissez un montant mensuel à côté de chaque catégorie. Laissez vide une catégorie sans limite. La barre colorée montre la part de chaque catégorie dans votre revenu net, et les totaux affichent les **Dépenses prévues**, l'**Épargne prévue** (revenu moins dépenses prévues, ou **Surallocation** si le plan dépasse vos revenus) et votre taux d'épargne." },
      { title: "Partez avec un coup de pouce", body: "**Suggérer d'après 3 mois** remplit chaque limite avec votre moyenne de dépenses dans la catégorie, arrondie à la dizaine supérieure. **Copier le mois dernier** reprend le plan du mois précédent. Les deux ne font que remplir le formulaire ; rien n'est enregistré avant Enregistrer." },
      { title: "Choisissez les mois concernés", body: "À côté de **Appliquer à** : **Tous les mois** l'enregistre comme budget par défaut, utilisé par chaque mois qui n'a pas son propre plan. **« Mois » seulement** enregistre un plan personnalisé pour ce mois-ci uniquement, un mois de vacances par exemple. Un mois avec un plan personnalisé affiche **Budget personnalisé pour ce mois**, avec **Utiliser le défaut** pour revenir en arrière." },
      { title: "Enregistrer", body: "Vos changements attendent dans une barre en bas de l'écran : **Enregistrer**, ou **Réinitialiser** pour les abandonner. Si vous quittez la page ou changez de mois avant, Gelbien vous demande s'il faut enregistrer." },
      { title: "Suivez le mois dans Prévu vs réel", body: "Cette carte montre combien de votre plan est déjà dépensé et ce qui **Reste à dépenser**. La partie hachurée de la barre correspond aux factures encore à payer ce mois-ci : de l'argent déjà mis de côté. Le petit repère vertical indique où vous en seriez aujourd'hui en dépensant régulièrement ; si votre barre le dépasse, vous dépensez plus vite que prévu. Une fois le mois terminé, elle compare votre épargne réelle à l'épargne prévue." },
      { title: "Vérifiez chaque catégorie", body: "Chaque limite a une barre de progression et un statut : **Dans le budget**, **Attention** (au-delà de votre seuil d'alerte, 85 % de la limite par défaut, réglable dans le Profil) ou **Dépassé**. Touchez une catégorie pour voir ses dépenses du mois." },
      { title: "Faites le bilan à la fin du mois", body: "Quand un mois se termine, ouvrez son bilan depuis le bandeau du tableau de bord ou avec **Voir le bilan du mois** sur la page Budget. Il montre ce que vous avez dépensé et épargné, votre valeur nette et **Quoi changer** : une limite que vous dépassez sans cesse (relevez-la, ou prévoyez de réduire), une que vous n'utilisez jamais (baissez-la et libérez de l'argent pour vos objectifs), des dépenses sans limite, des abonnements dont vous doutez. Puis le prévu vs réel par catégorie, ce qui a changé par rapport à l'habitude et vos plus grosses dépenses. **Planifier « mois suivant »** vous emmène directement au budget suivant." },
    ],
    tips: [
      "Les catégories sans limite comptent quand même dans vos dépenses ; Prévu vs réel indique combien y est allé.",
      "Une règle simple par laquelle beaucoup commencent : environ la moitié du revenu net pour les besoins, moins d'un tiers pour les envies, et au moins un cinquième pour l'épargne et les dettes.",
    ],
  },

  recurring: {
    title: "Factures récurrentes et abonnements",
    summary: "Loyer, services et abonnements : rappels, paiements anticipés et le ✓ pour les noter.",
    intro: [
      "Les dépenses récurrentes sont les paiements qui reviennent : loyer, téléphone, assurance et services (**factures**), Netflix, Spotify ou la salle de sport (**abonnements**). Les lister permet à Gelbien de vous rappeler chaque échéance, de mettre l'argent de côté dans votre budget avant qu'il ne quitte votre compte, et de montrer ce qu'ils coûtent vraiment par mois et par an.",
    ],
    steps: [
      { title: "En ajouter une", body: "Sur la page Budget, dans **Dépenses récurrentes**, touchez **Ajouter**. Choisissez **Facture** ou **Abonnement**, puis remplissez le **Nom**, le **Commerçant** (qui vous facture ; il est noté avec chaque paiement), le **Montant** et la **Fréquence** (d'hebdomadaire à annuelle), la **Catégorie** et la **Sous-catégorie** facultative, le **Jour de prélèvement** (pour les mensuelles) ou la date du **Prochain prélèvement** (pour les autres fréquences), le moyen de **Paiement** et le **Statut** : Actif, En pause, Annulé ou, pour les abonnements, Essai gratuit avec sa date de fin. Les abonnements ont aussi une note **Ça vaut le coût ?**." },
      { title: "Ou ajoutez-la en notant une dépense", body: "Dans le formulaire de dépense, ouvrez **+ Notes · dépense récurrente · remboursement** et activez **Dépense récurrente**. Choisissez quelle dépense récurrente correspond à ce paiement, ou **En ajouter une** : elle est ajoutée à la page Budget avec le montant, la catégorie et le commerçant de cette dépense, et se répète à partir de sa date." },
      { title: "Notez chaque paiement", body: "Le jour d'une facture, elle apparaît dans **Ces factures sont-elles payées ?** sur le tableau de bord : touchez **Payé** pour la noter. Payée en avance ? Touchez le ✓ à côté d'elle dans **Prochains prélèvements** sur le tableau de bord, ou dans la liste **Dépenses récurrentes** de la page Budget ; elle est notée à la date du jour. Les prélèvements notés affichent un ✓ vert avec la date. Survolez-le (ou touchez-le sur téléphone) pour supprimer cette dépense ; Gelbien demande d'abord une confirmation." },
      { title: "Voyez ce qu'elles coûtent", body: "La carte Dépenses récurrentes affiche votre total actif par mois et par an, et la part des abonnements, souvent l'endroit le plus facile où couper. Les essais gratuits sont signalés avec leur date de fin pour annuler à temps." },
    ],
    tips: [
      "Une dépense que vous saisissez vous-même compte comme payée si elle est dans la même catégorie et mentionne le nom ou le commerçant de la facture. Inutile de la relier à la main.",
      "Les factures encore à payer ce mois-ci sont retirées de ce qui reste à dépenser, sur le tableau de bord et dans Prévu vs réel.",
      "Mettez un abonnement en pause ou annulez-le au lieu de le supprimer pour garder son historique. Ceux en pause ou annulés ne comptent plus dans les totaux.",
      "Votre bilan du mois liste les abonnements notés Peut-être ou Non à Ça vaut le coût ?, avec leur coût annuel.",
    ],
  },

  goals: {
    title: "Objectifs, comptes et valeur nette",
    summary: "Épargner pour quelque chose de précis, suivre vos comptes avec un bilan mensuel et voir votre valeur nette.",
    intro: [
      "La page Objectifs a trois parties : vos **objectifs** (une voiture, une mise de fonds, un voyage), vos **comptes** (là où l'argent se trouve vraiment) et votre **valeur nette** (tout ce que vous possédez moins tout ce que vous devez).",
      "Gelbien ne se connecte jamais à votre banque. À la place, une fois par mois, vous saisissez le solde de chaque compte : un **bilan mensuel** de deux minutes. Objectifs, valeur nette et autonomie restent justes sans partager le moindre mot de passe.",
    ],
    steps: [
      { title: "Ajoutez vos comptes", body: "Dans **Comptes**, touchez **Ajouter un compte** : un nom, la banque ou l'institution, le type et le solde actuel. Les types sont de deux sortes : ce que vous possédez (compte chèques, épargne, placements, liquidités, un bien comme une maison ou une voiture, ou autre) et ce que vous devez (carte de crédit, marge de crédit, prêt, hypothèque). Pour une dette, saisissez le montant restant dû ; il est déduit de votre valeur nette." },
      { title: "Faites le bilan mensuel", body: "Le jour de votre bilan (le 1er par défaut ; modifiable dans la carte Comptes), un bandeau vous le rappelle. Touchez **Bilan mensuel**, saisissez chaque solde tel que l'affiche aujourd'hui votre application bancaire, et enregistrez. **Ajouter un rappel au calendrier** ajoute un rappel mensuel au calendrier de votre téléphone ou ordinateur." },
      { title: "Créez un objectif", body: "Touchez **Nouvel objectif**. Donnez-lui un nom et une icône, un **Montant visé** et, s'il y a une échéance, une **Date visée**. Puis indiquez où est l'argent. **Dans mes comptes** : choisissez les comptes qui le contiennent, et la progression suit leurs soldes à chaque bilan. **Suivi manuel** : saisissez ce que vous avez déjà mis de côté et utilisez **Ajouter un montant** à chaque nouvel ajout. Enfin, votre **Contribution mensuelle** et le **Rendement annuel prévu** ; les raccourcis aident : Liquidités (0 %), Épargne (~3 %), Placements (~6 %)." },
      { title: "Lisez la carte d'un objectif", body: "Chaque carte montre la progression, quand vous atteindrez le montant au rythme actuel et, avec une date visée, si vous êtes **En bonne voie** ou **En retard** et combien par mois l'objectif demande." },
      { title: "Simulez", body: "**Simuler** vous laisse jouer avec un objectif : une contribution mensuelle plus élevée, un autre rendement, un versement unique, un autre montant ou une autre date, ou la réduction d'une partie de vos dépenses superflues. Le scénario est comparé à votre plan actuel (« 8 mois plus tôt »). **Appliquer à l'objectif** l'enregistre ; rien ne change avant." },
      { title: "Vérifiez le plan mensuel", body: "Le **Plan mensuel** met côte à côte ce que vos objectifs demandent chaque mois, ce que votre budget prévoit d'épargner et ce que vous avez réellement épargné dernièrement. Si vos objectifs demandent plus que vous n'épargnez, il indique de combien, pour ajuster un objectif ou votre budget." },
      { title: "Suivez votre valeur nette", body: "**Valeur nette** affiche vos actifs, vos dettes et le total, mois par mois, à partir de votre premier bilan. C'est le meilleur chiffre pour suivre vos progrès sur le long terme." },
    ],
    tips: [
      "Vous avez fermé un compte ? Marquez-le **Fermé / masqué** au lieu de le supprimer, pour garder l'historique.",
      "La tuile **Autonomie** et le graphique **Projection de l'épargne** du tableau de bord utilisent ces soldes.",
    ],
  },

  chat: {
    title: "Chat",
    summary: "Posez vos questions d'argent en langage courant, avec des réponses tirées de vos propres données.",
    intro: [
      "Le Chat est un assistant IA qui lit vos dépenses, votre budget, vos paiements récurrents, vos comptes et vos objectifs avant de répondre. Demandez ce que vous demanderiez à un ami doué avec l'argent : « Combien ai-je dépensé au restaurant ce mois-ci ? », « Où pourrais-je économiser 200 $ le mois prochain ? », « Quels abonnements devrais-je reconsidérer ? », « Suis-je en bonne voie pour mon objectif d'épargne ? »",
    ],
    steps: [
      { title: "Connectez une IA", body: "Le Chat a besoin d'une IA. Dans **Profil → Assistant IA**, choisissez **Claude** (paiement à l'usage avec votre propre clé de console.anthropic.com, en général quelques centimes par question) ou **Gemini (gratuit)** (une clé gratuite d'aistudio.google.com, sans carte). Collez la clé et touchez **Tester la connexion**." },
      { title: "Demandez", body: "Tapez une question, ou touchez une des suggestions pour commencer. Les réponses s'affichent au fur et à mesure ; **Arrêter** en interrompt une. Les questions suivantes gardent le contexte de la conversation." },
      { title: "Recommencez", body: "**Nouvelle conversation** efface la conversation. Les conversations ne sont gardées que dans ce navigateur." },
    ],
    tips: [
      "La même connexion IA lit aussi les reçus, écrit les observations du tableau de bord et aide à traduire les catégories.",
      "Les requêtes vont directement de votre navigateur au fournisseur ; votre clé ne passe jamais par le serveur de Gelbien.",
      "Avec l'offre gratuite de Gemini, Google peut utiliser vos requêtes, y compris vos données de dépenses, pour améliorer ses produits.",
      "L'IA peut se tromper et ne remplace pas un conseil financier. Vérifiez les chiffres importants sur le tableau de bord ou la page Budget.",
    ],
  },

  categories: {
    title: "Catégories et moyens de paiement",
    summary: "Organisez vos dépenses à votre façon : catégories, sous-catégories, icônes, couleurs, ordre et moyens de paiement.",
    intro: [
      "Les catégories décident de la façon dont vos dépenses sont regroupées partout : budgets, graphiques et formulaire de dépense. Gelbien commence avec un ensemble raisonnable ; adaptez-le sur la page **Catégories** (dans le menu latéral sur ordinateur, ou derrière votre photo en haut à droite sur téléphone).",
      "Un bon ensemble de catégories est assez petit pour choisir en une seconde (une dizaine à une quinzaine) et correspond aux décisions que vous voulez prendre. Utilisez les sous-catégories pour le détail plutôt que d'ajouter des catégories.",
    ],
    steps: [
      { title: "Renommer, changer la couleur et l'icône", body: "Touchez le nom d'une catégorie pour la renommer ; toutes les dépenses et tous les budgets qui l'utilisent sont mis à jour aussi. Touchez son icône pour choisir une couleur et une icône." },
      { title: "Sous-catégories", body: "Touchez la flèche d'une catégorie pour l'ouvrir, puis ajoutez des sous-catégories (Épicerie → Supermarché, Boulangerie, Boucherie). Touchez une sous-catégorie pour la renommer (Entrée garde le nouveau nom, Échap annule) ; toutes les dépenses et dépenses récurrentes qui l'utilisent sont mises à jour à l'enregistrement. ✕ en retire une." },
      { title: "Changer l'ordre", body: "Utilisez les flèches haut et bas. C'est l'ordre des boutons de catégorie dans le formulaire de dépense : mettez les plus utilisées en haut." },
      { title: "Ajouter, masquer ou supprimer", body: "**Ajouter une catégorie** en crée une nouvelle. **Masquer** retire une catégorie du formulaire de dépense tout en gardant son historique. **Supprimer la catégorie** l'enlève, ou la masque à la place si des dépenses l'utilisent déjà, pour garder votre historique intact." },
      { title: "Moyens de paiement", body: "À droite (en dessous, sur téléphone) se trouvent les cartes et comptes avec lesquels vous payez. Ajoutez-en, renommez-les (les dépenses passées et les paiements récurrents sont mis à jour aussi), touchez une icône pour changer son apparence, réordonnez-les avec les flèches (le premier est celui par défaut pour les nouvelles dépenses récurrentes) ou retirez-en un avec ✕." },
      { title: "Enregistrer", body: "Les changements attendent dans la barre du bas jusqu'à ce que vous touchiez **Enregistrer**, ou **Réinitialiser** pour les annuler." },
      { title: "Traduire", body: "Vous avez changé la langue de l'application ? **Traduire les catégories** renomme dans cette langue les catégories et moyens de paiement intégrés et, avec l'IA, ceux que vous avez créés. Vous vérifiez chaque nom avant tout changement." },
    ],
  },

  profile: {
    title: "Profil",
    summary: "Langue, devise, IA, votre feuille, sauvegardes et déconnexion.",
    intro: [
      "Le Profil regroupe votre compte et vos réglages. Sur téléphone, touchez votre photo en haut à droite, puis **Profil** ; sur ordinateur, utilisez le bas du menu latéral.",
    ],
    steps: [
      { title: "Compte", body: "Affiche qui est connecté, ou Démo. Dans la démo, **Se connecter avec Google** passe à votre propre compte. **Catégories** est un raccourci vers cette page. **Se déconnecter** quitte ce navigateur ; vos données restent en sécurité dans votre feuille." },
      { title: "Préférences", body: "**Langue** et **Devise** s'appliquent partout et se synchronisent avec vos autres appareils grâce à votre feuille. **Objectif d'épargne mensuel**, c'est ce que vous aimeriez mettre de côté chaque mois ; les observations vous préviennent quand vous l'atteignez. **M'avertir quand un budget atteint** fixe le moment où une catégorie passe à Attention." },
      { title: "Assistant IA", body: "Choisissez **Désactivé**, **Claude** ou **Gemini (gratuit)**, collez votre clé (**Obtenir une clé** ouvre la page du fournisseur), choisissez un modèle et touchez **Tester la connexion**. La clé n'est enregistrée que dans ce navigateur : ajoutez-la sur chaque appareil." },
      { title: "Vos données", body: "**Ouvrir dans Google Sheets** ouvre votre feuille. **Synchroniser** la relit. **Sauvegarde (JSON)** télécharge tout et **Dépenses (CSV)** vos dépenses ; **Restaurer une sauvegarde** remplace toutes vos données par un fichier de sauvegarde. **Importer un classeur (.xlsx)** lit les dépenses, catégories, budget, revenus et abonnements d'un classeur de style Money Sheet, puis vous laisse **Ajouter à l'existant** ou **Tout remplacer**." },
      { title: "Cache hors ligne", body: "Une copie de vos données vit dans ce navigateur pour que Gelbien s'ouvre instantanément. **Vider le cache** oublie cette copie (votre feuille n'est pas touchée) et recharge tout, pratique si quelque chose semble périmé. Dans la démo, **Réinitialiser la démo** repart de zéro." },
    ],
  },

  concepts: {
    title: "Notions clés",
    summary: "Les termes que vous verrez dans Gelbien, expliqués.",
    intro: ["Un petit glossaire. Si un chiffre à l'écran vous intrigue, son explication est sans doute ici."],
    terms: [
      { term: "Revenu net", body: "Ce qui arrive sur votre compte après impôts et retenues. Budgets, épargne et taux d'épargne reposent dessus." },
      { term: "Budget (limite de dépenses)", body: "Le maximum que vous prévoyez de dépenser dans une catégorie sur un mois. Un plan, pas une punition : ajustez-le quand la vie change." },
      { term: "Budget par défaut vs personnalisé", body: "Le budget par défaut s'applique à tous les mois. Un budget personnalisé le remplace pour un seul mois, comme décembre et ses cadeaux ou un mois de voyage." },
      { term: "Épargne prévue", body: "Revenu net moins dépenses prévues : ce que le budget laisse pour épargner. Si elle est négative, le plan est en surallocation." },
      { term: "Taux d'épargne", body: "La part de votre revenu net que vous n'avez pas dépensée : (revenus − dépenses) ÷ revenus. Un taux de 20 % veut dire que vous avez gardé 1 $ sur 5 $." },
      { term: "Rythme", body: "Dépenser régulièrement, c'est avoir utilisé la moitié du budget à la moitié du mois. En avance sur le rythme signifie que vous dépensez plus vite : attendez-vous à dépasser le budget si vous ne ralentissez pas." },
      { term: "Dans le budget · Attention · Dépassé", body: "Le statut d'une catégorie : sous votre seuil d'alerte, au-delà (85 % de la limite par défaut), ou au-dessus de la limite. Sans limite signifie que la catégorie n'a pas de budget." },
      { term: "Fixe vs variable", body: "Les frais fixes sont les mêmes chaque mois (loyer, téléphone) ; les variables changent (épicerie, essence). C'est sur les frais variables que les choix du quotidien comptent." },
      { term: "Essentiel · Important · Superflu", body: "À quel point vous avez besoin d'une dépense. Essentiel : vous la paieriez quoi qu'il arrive. Important : utile, mais il y a de la marge. Superflu : agréable, et le premier endroit où regarder pour épargner davantage." },
      { term: "Facture vs abonnement", body: "Les deux reviennent. Les factures sont des obligations (loyer, électricité, assurance) ; les abonnements sont des services choisis (streaming, applications, sport) que l'on peut en général annuler. Seuls les abonnements ont des essais gratuits et une note Ça vaut le coût ?." },
      { term: "Factures à payer", body: "Les prélèvements récurrents prévus plus tard ce mois-ci, sans dépense notée pour l'instant. Gelbien les compte déjà comme dépensés quand il vous dit ce qui reste." },
      { term: "Bilan mensuel", body: "Une fois par mois, vous saisissez le solde de chaque compte. C'est ainsi que Gelbien connaît votre valeur nette et la progression de vos objectifs sans se connecter à votre banque." },
      { term: "Valeur nette", body: "Tout ce que vous possédez (comptes, placements, liquidités) moins tout ce que vous devez (cartes de crédit, prêts)." },
      { term: "Autonomie", body: "Si vous dépensez plus que vous ne gagnez, combien de mois votre épargne couvrirait l'écart. Elle compte l'argent dont vous pourriez vraiment vivre (comptes, liquidités et placements, moins les cartes et marges de crédit), pas une maison, un prêt ni une hypothèque. Durable signifie que vos revenus couvrent vos dépenses." },
      { term: "Rendement annuel prévu", body: "De combien l'argent d'un objectif grandit tout seul chaque année : environ 0 % en liquidités, quelques pour cent sur un compte d'épargne à intérêt élevé, davantage (avec des hauts et des bas) une fois placé." },
      { term: "Achat réparti", body: "Un paiement divisé entre plusieurs catégories, pour que chaque partie compte dans le bon budget." },
      { term: "Remboursement", body: "De l'argent qui vous revient sur un achat. Il est noté comme une dépense négative et réduit les dépenses de la catégorie." },
    ],
  },

  faq: {
    title: "Questions",
    summary: "Confidentialité, votre feuille, appareils, coûts et plus.",
    intro: [],
    faq: [
      { q: "Où sont mes données, et qui peut les voir ?", a: "Dans une feuille Google de votre propre Google Drive. Gelbien ne peut ouvrir que les fichiers qu'il a créés, pas le reste de votre Drive. Personne d'autre ne voit vos données, sauf si vous partagez vous-même la feuille. La démo garde ses données d'exemple uniquement dans votre navigateur." },
      { q: "Puis-je modifier la feuille directement ?", a: "Oui. Gelbien la relit après chaque changement et chaque fois que vous synchronisez : avec l'icône de nuage en haut sur ordinateur, ou sur téléphone avec votre photo en haut à droite, puis Synchroniser. Modifiez les valeurs librement, mais ne renommez ni ne supprimez ses onglets, sa ligne d'en-tête ou la colonne id, sinon Gelbien ne reconnaîtra plus sa structure." },
      { q: "Dois-je connecter ma banque ?", a: "Non, et Gelbien ne vous le demandera jamais : il n'accepte aucun identifiant bancaire. Vous notez vos dépenses vous-même (ou depuis des reçus), et les soldes viennent de votre bilan mensuel." },
      { q: "Est-ce que ça coûte quelque chose ?", a: "Gelbien n'exige aucun service payant. L'IA est facultative : Gemini a une offre gratuite, et Claude facture quelques centimes par utilisation sur votre propre clé." },
      { q: "Puis-je l'utiliser sur mon téléphone et mon ordinateur ?", a: "Oui. Connectez-vous avec le même compte Google sur les deux et vos données restent synchronisées grâce à votre feuille. Si ce que vous venez d'ajouter n'apparaît pas sur l'autre appareil, synchronisez (icône de nuage en haut, ou votre photo → Synchroniser sur téléphone). Votre clé IA est propre à chaque navigateur : ajoutez-la sur chaque appareil." },
      { q: "Un enregistrement a échoué. Ai-je perdu mes changements ?", a: "Non. Gelbien explique pourquoi (pas de connexion, stockage Google plein, Google occupé) et garde ce que vous avez saisi pour réessayer dans un instant." },
      { q: "Quelque chose semble faux ou périmé.", a: "Synchronisez d'abord (icône de nuage en haut, ou votre photo → Synchroniser sur téléphone). Si ça ne suffit pas, Profil → Vider le cache recharge tout depuis votre feuille. La feuille elle-même n'est jamais touchée." },
      { q: "Comment recommencer la démo, ou la quitter ?", a: "Profil → Réinitialiser la démo repart de zéro. Pour utiliser vos propres données, touchez Se connecter avec Google dans le Profil." },
      { q: "Comment revoir la visite de bienvenue ?", a: "En haut de ce guide, touchez Revoir la visite de bienvenue." },
      { q: "Comment supprimer mes données ?", a: "Vos données, c'est la feuille dans votre Drive : supprimez-la là-bas (et videz la corbeille), puis déconnectez-vous. Pour retirer aussi l'accès de Gelbien, allez dans votre Compte Google → Sécurité → Applications et services tiers." },
    ],
  },
};

export default fr;

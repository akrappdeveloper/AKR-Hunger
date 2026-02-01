Console Error

A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:
- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

See more info here: https://nextjs.org/docs/messages/react-hydration-error


  ...
    <script>
    <script>
    <script>
    <CustomerLayout>
      <div className="min-h-scre...">
        <CustomerNavbar>
          <header className="sticky top...">
            <div className="max-w-7xl ...">
              <div className="flex items...">
                <LinkComponent>
                <Dialog open={false} onOpenChange={function bound dispatchSetState}>
                  <Dialog data-slot="dialog" open={false} onOpenChange={function bound dispatchSetState}>
                    <DialogProvider scope={undefined} triggerRef={{current:null}} contentRef={{current:null}} ...>
                      <DialogTrigger asChild={true}>
                        <DialogTrigger data-slot="dialog-tri..." asChild={true}>
                          <Primitive.button type="button" aria-haspopup="dialog" aria-expanded={false} ...>
                            <Slot type="button" aria-haspopup="dialog" aria-expanded={false} ...>
                              <SlotClone type="button" aria-haspopup="dialog" aria-expanded={false} ...>
                                <button
                                  className="hidden md:flex flex-col items-start text-left cursor-pointer hover:bg-whi..."
                                  type="button"
                                  aria-haspopup="dialog"
                                  aria-expanded={false}
+                                 aria-controls="radix-_R_9kndlb_"
-                                 aria-controls="radix-_R_15kndlb_"
                                  data-state="closed"
                                  data-slot="dialog-trigger"
                                  onClick={function handleEvent}
                                  ref={function}
                                >
                      ...
              <div>
              ...
                <Dialog data-slot="sheet">
                  <DialogProvider scope={undefined} triggerRef={{current:null}} contentRef={{current:null}} ...>
                    <SheetTrigger asChild={true}>
                      <DialogTrigger data-slot="sheet-trigger" asChild={true}>
                        <Primitive.button type="button" aria-haspopup="dialog" aria-expanded={false} ...>
                          <Slot type="button" aria-haspopup="dialog" aria-expanded={false} aria-controls="radix-_R_j..." ...>
                            <SlotClone type="button" aria-haspopup="dialog" aria-expanded={false} ...>
                              <Button variant="ghost" size="icon" className="md:hidden ..." type="button" ...>
                                <button
                                  data-slot="sheet-trigger"
                                  className={"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded..."}
                                  type="button"
                                  aria-haspopup="dialog"
                                  aria-expanded={false}
+                                 aria-controls="radix-_R_jkndlb_"
-                                 aria-controls="radix-_R_2dkndlb_"
                                  data-state="closed"
                                  onClick={function handleEvent}
                                  ref={function}
                                >
                    ...
        ...
components/customer/CustomerNavbar.tsx (113:17) @ CustomerNavbar


  111 |             <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
  112 |               <DialogTrigger asChild>
> 113 |                 <button className="hidden md:flex flex-col items-start text-left cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors group">
      |                 ^
  114 |                   <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wider flex items-center gap-1 group-hover:text-orange-400">
  115 |                     <MapPin className="w-3 h-3" /> Delivery Location
  116 |                   </span>

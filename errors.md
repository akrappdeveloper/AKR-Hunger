Console Error


Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.
app/admin/orders/page.tsx (357:25) @ <unknown>


  355 |                       const StatusIcon = status.icon;
  356 |                       return (
> 357 |                         <TableRow key={order.id} className="border-gray-800 hover:bg-gray-800/30 transition-colors">
      |                         ^
  358 |                           <TableCell>
  359 |                             <Checkbox
  360 |                               checked={selectedOrders.includes(order.id!)}


and 

Console Error


Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.
app/admin/orders/page.tsx (357:25) @ <unknown>


  355 |                       const StatusIcon = status.icon;
  356 |                       return (
> 357 |                         <TableRow key={order.id} className="border-gray-800 hover:bg-gray-800/30 transition-colors">
      |                         ^
  358 |                           <TableCell>
  359 |                             <Checkbox
  360 |                               checked={selectedOrders.includes(order.id!)}
 


and 


Console FirebaseError


Missing or insufficient permissions.
